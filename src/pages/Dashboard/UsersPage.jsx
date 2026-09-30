import React, { useCallback, useMemo, useState, useEffect } from "react";
import Modal from "../../components/Modal/Modal";
import Pagination from "../../components/Pagination/Pagination";
import { useApiRequest } from "../../hooks/useApiRequest";
import { SkeletonTableRows } from "../../components/Skeleton/Skeleton";
import useMediaQuery from "../../hooks/useMediaQuery";
import "./UsersPage.css";

const ROLE_TABS = [
  { value: "all", label: "All" },
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents" },
  { value: "instructor", label: "Instructors" },
  { value: "admin", label: "Admins" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Any status" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending approval" },
  { value: "rejected", label: "Rejected" },
  { value: "inactive", label: "Inactive" },
];

// The list endpoint pages but returns no total, so the page loads everyone in
// batches and filters in the browser. Paging the server list directly meant
// the pager always thought there was one page: anyone past the first 20 was
// unreachable, and so were they in the link dialogs, which read this list.
// 100 per batch keeps working if the API ever caps its page size; the batch
// cap guards against a runaway loop.
const USERS_BATCH = 100;
const MAX_BATCHES = 50;

const roleBadge = (role) => {
  const colors = {
    admin: { bg: "rgba(239,68,68,0.1)", color: "#ef4444" },
    instructor: { bg: "rgba(59,130,246,0.1)", color: "#3b82f6" },
    student: { bg: "rgba(16,185,129,0.1)", color: "#10b981" },
    parent: { bg: "rgba(139,92,246,0.1)", color: "#8b5cf6" },
  };
  const c = colors[role] || colors.student;
  return (
    <span
      className="modal-badge"
      style={{
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.color}33`,
        fontWeight: 700,
      }}
    >
      {role}
    </span>
  );
};

/* Avatar background per role */
const roleAvatarBg = {
  admin: "#ef4444",
  instructor: "#3b82f6",
  student: "#10b981",
  parent: "#8b5cf6",
};

const approvalRequiredRoles = new Set(["student", "parent"]);

const getApprovalStatus = (user) => {
  if (!approvalRequiredRoles.has(user.role)) return "approved";
  return user.approvalStatus || "approved";
};

const canManageConnections = (user) =>
  user.isActive !== false && getApprovalStatus(user) === "approved";

const accountStatusBadge = (user) => {
  if (user.isActive === false) {
    return (
      <span
        className="modal-badge"
        style={{
          background: "rgba(107,114,128,0.12)",
          color: "#6b7280",
          border: "1px solid #6b728033",
          fontWeight: 700,
        }}
      >
        Inactive
      </span>
    );
  }

  const approvalStatus = getApprovalStatus(user);
  if (approvalStatus === "pending") {
    return (
      <span
        className="modal-badge"
        style={{
          background: "rgba(245,158,11,0.12)",
          color: "#d97706",
          border: "1px solid #f59e0b33",
          fontWeight: 700,
        }}
      >
        Pending approval
      </span>
    );
  }
  if (approvalStatus === "rejected") {
    return (
      <span
        className="modal-badge"
        style={{
          background: "rgba(239,68,68,0.1)",
          color: "#ef4444",
          border: "1px solid #ef444433",
          fontWeight: 700,
        }}
      >
        Rejected
      </span>
    );
  }

  return (
    <span
      className="modal-badge"
      style={{
        background: "rgba(16,185,129,0.1)",
        color: "#10b981",
        border: "1px solid #10b98133",
        fontWeight: 700,
      }}
    >
      Active
    </span>
  );
};

// Who reviewed this account and when. approvalReviewedBy is populated by the
// API, so it is an object with a name rather than an id; older records that
// predate the review fields simply render nothing.
const ReviewedLine = ({ user }) => {
  if (!approvalRequiredRoles.has(user.role)) return null;

  const status = getApprovalStatus(user);
  if (status === "pending") return null;

  const reviewer = user.approvalReviewedBy;
  const reviewedAt = user.approvalReviewedAt;
  if (!reviewer && !reviewedAt) return null;

  const verb = status === "rejected" ? "Rejected" : "Approved";
  const who = reviewer?.FullName || reviewer?.Email;
  const when = reviewedAt ? new Date(reviewedAt).toLocaleDateString() : null;

  return (
    <div
      style={{
        color: "var(--text-muted)",
        fontSize: "0.72rem",
        marginTop: "0.25rem",
        overflowWrap: "anywhere",
      }}
      title={reviewedAt ? new Date(reviewedAt).toLocaleString() : undefined}
    >
      {verb}
      {who ? ` by ${who}` : ""}
      {when ? ` · ${when}` : ""}
    </div>
  );
};

const UserAvatar = ({ user, size = 36 }) => {
  const initials = (user.FullName || user.UserName || "U")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <span
      className="users-avatar"
      aria-hidden="true"
      style={{ width: size, height: size, background: roleAvatarBg[user.role] || "#10b981" }}
    >
      {initials}
    </span>
  );
};

const EmptyUsers = ({ filtered, onClear }) => (
  <div className="users-empty">
    <i className={filtered ? "fa-solid fa-magnifying-glass" : "fa-solid fa-user-plus"} aria-hidden="true" />
    <strong>{filtered ? "No one matches these filters" : "No users yet"}</strong>
    {filtered ? (
      <button type="button" className="users-row-action" onClick={onClear} style={{ marginTop: "0.75rem" }}>
        Clear filters
      </button>
    ) : (
      <span>Add the first account with the Add User button.</span>
    )}
  </div>
);

const accountStatusOf = (user) => {
  if (user.isActive === false) return "inactive";
  const approval = getApprovalStatus(user);
  return approval === "approved" ? "active" : approval;
};

const linkActionFor = (user) => {
  if (!canManageConnections(user)) return null;
  const labels = { parent: "Link student", instructor: "Assign student", student: "Links" };
  return labels[user.role] ? { type: user.role, label: labels[user.role] } : null;
};

const UsersPage = () => {
  const { request } = useApiRequest();

  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvalActionId, setApprovalActionId] = useState(null);
  const [approvalError, setApprovalError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* Pagination */
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  /* Filters */
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);

  // A five-column table cannot be read on a phone. Below this width the rows
  // are rendered as cards instead, with the per-row actions collapsed into a
  // menu — three inline buttons is what made the action column wider than the
  // screen and forced the whole table to scroll sideways.
  const isMobile = useMediaQuery("(max-width: 720px)");
  const [openMenuId, setOpenMenuId] = useState(null);

  // Dismiss the open row menu the way menus are expected to behave. Both
  // listeners set state from a callback, not from the effect body.
  useEffect(() => {
    if (!openMenuId) return undefined;

    const onPointerDown = (event) => {
      if (!event.target.closest("[data-user-menu]")) setOpenMenuId(null);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenuId]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const emptyForm = {
    FullName: "",
    UserName: "",
    Email: "",
    password: "",
    role: "student",
  };
  const [formData, setFormData] = useState(emptyForm);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const all = [];
      for (let batch = 1; batch <= MAX_BATCHES; batch += 1) {
        const params = new URLSearchParams({ page: String(batch), limit: String(USERS_BATCH) });
        const data = await request(`/api/v1/user?${params.toString()}`);
        const list = data.data?.docs || data.data?.users || data.data || [];
        const rows = Array.isArray(list) ? list : [];
        all.push(...rows);
        if (rows.length < USERS_BATCH) break;
      }
      setUsers(all);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const fetchAssignments = useCallback(async () => {
    try {
      const data = await request("/api/v1/student-instructor-assignments");
      setAssignments(data.data?.assignments || []);
    } catch {
      setAssignments([]);
    }
  }, [request]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const data = await request("/api/v1/user/pending-approvals");
      setPendingApprovals(data.data?.users || []);
      setApprovalError(null);
    } catch (err) {
      setApprovalError(err.message);
    }
  }, [request]);

  useEffect(() => {
    fetchPendingApprovals();
  }, [fetchPendingApprovals]);

  const handleApprovalReview = async (userId, approvalStatus) => {
    setApprovalActionId(userId);
    setApprovalError(null);
    try {
      await request(`/api/v1/user/${userId}/approval`, "PATCH", {
        approvalStatus,
      });
      await Promise.all([fetchUsers(), fetchPendingApprovals()]);
    } catch (err) {
      setApprovalError(err.message);
    } finally {
      setApprovalActionId(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      await request("/api/v1/user", "POST", formData);
      setShowCreate(false);
      setFormData(emptyForm);
      await fetchUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      const payload = {
        FullName: formData.FullName,
        UserName: formData.UserName,
        role: formData.role,
      };
      if (formData.password) {
        payload.password = formData.password;
      }
      await request(`/api/v1/user/${editUser._id}`, "PATCH", payload);
      setEditUser(null);
      await fetchUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    setFormLoading(true);
    setFormError(null);
    try {
      await request(`/api/v1/user/${deleteUser._id}`, "DELETE");
      setDeleteUser(null);
      await fetchUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const openEdit = (u) => {
    setFormData({
      FullName: u.FullName || "",
      UserName: u.UserName || "",
      Email: u.Email || "",
      password: "",
      role: u.role || "student",
    });
    setFormError(null);
    setEditUser(u);
  };

  const [linkTargetUser, setLinkTargetUser] = useState(null);
  const [linkModalType, setLinkModalType] = useState(null); // 'parent' or 'instructor' or 'student'
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedParentId, setSelectedParentId] = useState("");
  const [selectedInstructorId, setSelectedInstructorId] = useState("");
  const [linkActionLoading, setLinkActionLoading] = useState(false);
  const [linkActionError, setLinkActionError] = useState(null);
  const [linkActionSuccess, setLinkActionSuccess] = useState(null);

  const openLinkModal = (userObj, type) => {
    setLinkTargetUser(userObj);
    setLinkModalType(type);
    setSelectedStudentId("");
    setSelectedParentId("");
    setSelectedInstructorId("");
    setLinkActionError(null);
    setLinkActionSuccess(null);
  };

  const handleAdminLinkParent = async (e) => {
    e.preventDefault();
    setLinkActionLoading(true);
    setLinkActionError(null);
    setLinkActionSuccess(null);
    try {
      const studentId =
        linkModalType === "student" ? linkTargetUser._id : selectedStudentId;
      const parentId =
        linkModalType === "parent" ? linkTargetUser._id : selectedParentId;

      await request("/api/v1/StudentProfile/admin/link-parent", "POST", {
        studentUserId: studentId,
        parentUserId: parentId,
      });

      setLinkActionSuccess("Parent successfully linked to student!");
      fetchUsers();
      setTimeout(() => {
        setLinkTargetUser(null);
        setLinkActionSuccess(null);
      }, 1500);
    } catch (err) {
      setLinkActionError(err.message);
    } finally {
      setLinkActionLoading(false);
    }
  };

  const handleAdminLinkInstructor = async (e) => {
    e.preventDefault();
    setLinkActionLoading(true);
    setLinkActionError(null);
    setLinkActionSuccess(null);
    try {
      const studentId =
        linkModalType === "student" ? linkTargetUser._id : selectedStudentId;
      const instructorId =
        linkModalType === "instructor"
          ? linkTargetUser._id
          : selectedInstructorId;

      await request("/api/v1/student-instructor-assignments", "POST", {
        studentUserId: studentId,
        instructorUserId: instructorId,
      });

      setLinkActionSuccess(
        "Instructor assigned. The learning-team channel is ready.",
      );
      await Promise.all([fetchUsers(), fetchAssignments()]);
      setTimeout(() => {
        setLinkTargetUser(null);
        setLinkActionSuccess(null);
      }, 1500);
    } catch (err) {
      setLinkActionError(err.message);
    } finally {
      setLinkActionLoading(false);
    }
  };

  const handleUnassignInstructor = async (assignmentId) => {
    setLinkActionLoading(true);
    setLinkActionError(null);
    setLinkActionSuccess(null);
    try {
      await request(
        `/api/v1/student-instructor-assignments/${assignmentId}`,
        "DELETE",
      );
      setLinkActionSuccess(
        "Assignment ended and the learning-team channel was archived.",
      );
      await fetchAssignments();
    } catch (err) {
      setLinkActionError(err.message);
    } finally {
      setLinkActionLoading(false);
    }
  };

  // Search and status narrow the list; the role tabs count the matches in
  // each role, so a tab's number is always what you would see after clicking.
  const matchesSearchAndStatus = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== "all" && accountStatusOf(u) !== statusFilter) return false;
      if (!needle) return true;
      return [u.FullName, u.UserName, u.Email].some((field) =>
        (field || "").toLowerCase().includes(needle),
      );
    });
  }, [users, query, statusFilter]);

  const roleCounts = useMemo(() => {
    const counts = { all: matchesSearchAndStatus.length };
    matchesSearchAndStatus.forEach((u) => {
      counts[u.role] = (counts[u.role] || 0) + 1;
    });
    return counts;
  }, [matchesSearchAndStatus]);

  const filteredUsers = useMemo(
    () =>
      roleFilter === "all"
        ? matchesSearchAndStatus
        : matchesSearchAndStatus.filter((u) => u.role === roleFilter),
    [matchesSearchAndStatus, roleFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / limit));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * limit, currentPage * limit);
  const hasFilters = Boolean(query.trim()) || roleFilter !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const headcount = (() => {
    if (loading && users.length === 0) return "Loading people\u2026";
    const parts = [`${users.length} ${users.length === 1 ? "person" : "people"}`];
    ["student", "parent", "instructor", "admin"].forEach((role) => {
      const n = users.filter((u) => u.role === role).length;
      if (n) parts.push(`${n} ${role}${n === 1 ? "" : "s"}`);
    });
    return parts.join(" \u00b7 ");
  })();

  const studentsList = users.filter(
    (u) => u.role === "student" && canManageConnections(u),
  );
  const parentsList = users.filter(
    (u) => u.role === "parent" && canManageConnections(u),
  );
  const instructorsList = users.filter(
    (u) => u.role === "instructor" && canManageConnections(u),
  );
  const targetAssignments = assignments.filter((assignment) => {
    if (!linkTargetUser) return false;
    if (linkTargetUser.role === "instructor") {
      return assignment.instructorId?._id === linkTargetUser._id;
    }
    if (linkTargetUser.role === "student") {
      return assignment.studentProfileId?.user?._id === linkTargetUser._id;
    }
    return false;
  });
  const isAssignedPair = (studentUserId, instructorUserId) =>
    assignments.some(
      (assignment) =>
        assignment.studentProfileId?.user?._id === studentUserId &&
        assignment.instructorId?._id === instructorUserId,
    );

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div className="dash-head-titles">
          <h1 className="dash-title">
            <i className="fa-solid fa-users" style={{ color: "var(--brand-primary)" }} />
            Users
          </h1>
          <p className="dash-subtitle">{headcount}</p>
        </div>
        <div className="dash-head-actions">
          <button
            type="button"
            onClick={() => {
              setFormData(emptyForm);
              setFormError(null);
              setShowCreate(true);
            }}
            className="nb-btn nb-btn-primary"
            style={{ padding: "0.65rem 1.4rem" }}
          >
            <i className="fa-solid fa-user-plus" style={{ marginRight: "0.4rem" }} /> Add User
          </button>
        </div>
      </div>

      {error && <p role="alert" style={{ color: "var(--error)" }}>{error}</p>}
      {approvalError && (
        <p role="alert" style={{ color: "var(--error)" }}>
          {approvalError}
        </p>
      )}

      {pendingApprovals.length > 0 && (
        <section
          aria-label="Pending account approvals"
          className="glass-panel"
          style={{
            borderRadius: "var(--radius-md)",
            marginBottom: "1.25rem",
            overflow: "hidden",
            border: "1.5px solid rgba(245,158,11,0.45)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "0.9rem 1.25rem",
              background: "rgba(245,158,11,0.1)",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "1rem" }}>
                <i className="fa-solid fa-user-clock" style={{ color: "var(--warning)", marginRight: "0.5rem" }} />
                Waiting for approval
              </h2>
              <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                These new student and parent accounts cannot use the dashboard until you approve them.
              </p>
            </div>
            <span
              className="modal-badge"
              style={{
                background: "rgba(245,158,11,0.15)",
                color: "var(--warning)",
                border: "1px solid rgba(245,158,11,0.45)",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {pendingApprovals.length} waiting
            </span>
          </div>
          <div style={{ display: "grid", gap: "0.75rem", padding: "1rem 1.25rem" }}>
            {pendingApprovals.map((pendingUser) => (
              <div
                key={pendingUser._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                  paddingBottom: "0.75rem",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong>{pendingUser.FullName}</strong>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", overflowWrap: "anywhere" }}>
                    {" "}&middot; {pendingUser.Email} &middot; {pendingUser.role}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="modal-btn modal-btn-danger"
                    style={{ width: "auto", padding: "0.45rem 0.75rem" }}
                    disabled={approvalActionId === pendingUser._id}
                    onClick={() => handleApprovalReview(pendingUser._id, "rejected")}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="modal-btn modal-btn-primary"
                    style={{ width: "auto", padding: "0.45rem 0.75rem" }}
                    disabled={approvalActionId === pendingUser._id}
                    onClick={() => handleApprovalReview(pendingUser._id, "approved")}
                  >
                    {approvalActionId === pendingUser._id ? "Saving..." : "Approve"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Find people ─── */}
      <div className="users-toolbar">
        <div className="users-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, username or email"
            aria-label="Search users"
          />
          {query && (
            <button
              type="button"
              className="users-search-clear"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setPage(1);
              }}
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" style={{ position: "static", transform: "none" }} />
            </button>
          )}
        </div>

        <div className="users-roles" role="tablist" aria-label="Filter by role">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={roleFilter === tab.value}
              className="users-role-tab"
              onClick={() => {
                setRoleFilter(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
              <span className="users-role-count">{roleCounts[tab.value] ?? 0}</span>
            </button>
          ))}
        </div>

        <select
          className="users-status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* ─── Desktop table ─── */}
      {!isMobile && (
        <div className="glass-panel dash-panel">
          <div className="dash-table-wrap is-wide">
            <table className="users-table">
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonTableRows cols={4} rows={6} />}
                {!loading &&
                  pagedUsers.map((u) => {
                    const link = linkActionFor(u);
                    return (
                      <tr key={u._id}>
                        <td>
                          <div className="users-person">
                            <UserAvatar user={u} />
                            <div style={{ minWidth: 0 }}>
                              <button
                                type="button"
                                className="users-name-button"
                                onClick={() => openEdit(u)}
                                title="Open details"
                              >
                                {u.FullName}
                              </button>
                              <span className="users-meta">
                                @{u.UserName} &middot; {u.Email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>{roleBadge(u.role)}</td>
                        <td>
                          {accountStatusBadge(u)}
                          <ReviewedLine user={u} />
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="users-actions">
                            {link && (
                              <button
                                type="button"
                                className="users-row-action"
                                onClick={() => openLinkModal(u, link.type)}
                              >
                                <i className="fa-solid fa-link" aria-hidden="true" /> {link.label}
                              </button>
                            )}
                            <button
                              type="button"
                              className="users-row-action"
                              onClick={() => openEdit(u)}
                              aria-label={`Edit ${u.FullName || u.UserName || "user"}`}
                            >
                              <i className="fa-solid fa-pen" aria-hidden="true" /> Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {!loading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="4">
                      <EmptyUsers filtered={hasFilters} onClear={clearFilters} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Phone cards ─── */}
      {isMobile && (
        <div className="users-cards">
          {loading && (
            <div className="users-card" aria-busy="true">
              <span className="users-meta">Loading people&hellip;</span>
            </div>
          )}

          {!loading && filteredUsers.length === 0 && (
            <div className="users-card">
              <EmptyUsers filtered={hasFilters} onClear={clearFilters} />
            </div>
          )}

          {!loading &&
            pagedUsers.map((u) => {
              const menuOpen = openMenuId === u._id;
              const link = linkActionFor(u);
              return (
                <div key={u._id} className="users-card">
                  <div className="users-card-top">
                    <UserAvatar user={u} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <button
                        type="button"
                        className="users-name-button"
                        onClick={() => openEdit(u)}
                      >
                        {u.FullName}
                      </button>
                      <span className="users-meta">@{u.UserName}</span>
                      <span className="users-meta" style={{ color: "var(--text-secondary)" }}>
                        {u.Email}
                      </span>
                    </div>
                    <div data-user-menu>
                      <button
                        type="button"
                        className="users-menu-button"
                        onClick={() => setOpenMenuId(menuOpen ? null : u._id)}
                        aria-label={`Actions for ${u.FullName}`}
                        aria-expanded={menuOpen}
                      >
                        <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="users-card-badges">
                    {roleBadge(u.role)}
                    {accountStatusBadge(u)}
                  </div>
                  <ReviewedLine user={u} />

                  {menuOpen && (
                    <div data-user-menu role="menu" className="users-card-menu">
                      {link && (
                        <button
                          type="button"
                          role="menuitem"
                          className="users-row-action"
                          onClick={() => {
                            setOpenMenuId(null);
                            openLinkModal(u, link.type);
                          }}
                        >
                          <i className="fa-solid fa-link" aria-hidden="true" /> {link.label}
                        </button>
                      )}
                      <button
                        type="button"
                        role="menuitem"
                        className="users-row-action"
                        onClick={() => {
                          setOpenMenuId(null);
                          openEdit(u);
                        }}
                      >
                        <i className="fa-solid fa-pen" aria-hidden="true" /> Edit
                      </button>
                      {u.isActive !== false && (
                        <button
                          type="button"
                          role="menuitem"
                          className="users-row-action is-danger"
                          onClick={() => {
                            setOpenMenuId(null);
                            setDeleteUser(u);
                          }}
                        >
                          <i className="fa-solid fa-trash" aria-hidden="true" /> Deactivate
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {!loading && filteredUsers.length > 0 && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
          total={filteredUsers.length}
        />
      )}

      {/* ═══ CREATE MODAL ═══ */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New User"
        size="md"
      >
        <form onSubmit={handleCreate}>
          {formError && (
            <div className="modal-error">
              <i className="fa-solid fa-triangle-exclamation" /> {formError}
            </div>
          )}
          <div className="modal-row modal-row-2">
            <div className="modal-form-group">
              <label className="modal-label">Full Name</label>
              <input
                className="modal-input"
                required
                placeholder="John Doe"
                value={formData.FullName}
                onChange={(e) =>
                  setFormData({ ...formData, FullName: e.target.value })
                }
              />
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Username</label>
              <input
                className="modal-input"
                required
                autoComplete="off"
                placeholder="johndoe"
                value={formData.UserName}
                onChange={(e) =>
                  setFormData({ ...formData, UserName: e.target.value })
                }
              />
            </div>
          </div>
          <div className="modal-form-group">
            <label className="modal-label">Email</label>
            <input
              className="modal-input"
              type="email"
              required
              autoComplete="off"
              placeholder="john@example.com"
              value={formData.Email}
              onChange={(e) =>
                setFormData({ ...formData, Email: e.target.value })
              }
            />
          </div>
          <div className="modal-form-group">
            <label className="modal-label">Password</label>
            {/* autoComplete="new-password" keeps the browser's password manager
                from autofilling the admin's own saved credentials over the
                password being typed here — the account would then be created
                with a password nobody knows. */}
            <input
              className="modal-input"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
            <p className="modal-hint">
              At least 8 characters. Stored exactly as typed — leading and
              trailing spaces count.
            </p>
          </div>
          <div className="modal-form-group">
            <label className="modal-label">Role</label>
            <select
              className="modal-select"
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }
            >
              <option value="student">Student</option>
              <option value="parent">Parent</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={formLoading}
            className="modal-btn modal-btn-primary"
          >
            {formLoading ? (
              "Creating..."
            ) : (
              <>
                <i className="fa-solid fa-plus" /> Create User
              </>
            )}
          </button>
        </form>
      </Modal>

      {/* ═══ EDIT MODAL ═══ */}
      <Modal
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        title={`Edit — ${editUser?.FullName}`}
        size="md"
      >
        <form onSubmit={handleUpdate}>
          {formError && (
            <div className="modal-error">
              <i className="fa-solid fa-triangle-exclamation" /> {formError}
            </div>
          )}
          <div className="modal-profile-header">
            <div className="modal-profile-avatar">
              {(editUser?.FullName || "U")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div className="modal-profile-info">
              <h3>{editUser?.FullName}</h3>
              <p>{editUser?.Email}</p>
            </div>
          </div>
          <div className="modal-row modal-row-2">
            <div className="modal-form-group">
              <label className="modal-label">Full Name</label>
              <input
                className="modal-input"
                value={formData.FullName}
                onChange={(e) =>
                  setFormData({ ...formData, FullName: e.target.value })
                }
              />
            </div>
            <div className="modal-form-group">
              <label className="modal-label">Username</label>
              <input
                className="modal-input"
                value={formData.UserName}
                onChange={(e) =>
                  setFormData({ ...formData, UserName: e.target.value })
                }
              />
            </div>
          </div>
          <div className="modal-form-group">
            <label className="modal-label">Email</label>
            <input className="modal-input" disabled value={formData.Email} />
            <p className="modal-hint">Email cannot be changed</p>
          </div>
          <div className="modal-section-label">Change Password (optional)</div>
          <div className="modal-form-group">
            <label className="modal-label">New Password</label>
            <input
              className="modal-input"
              type="password"
              minLength={8}
              autoComplete="new-password"
              placeholder="Leave empty to keep"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
            <p className="modal-hint">
              At least 8 characters. Stored exactly as typed — leading and
              trailing spaces count.
            </p>
          </div>
          <div className="modal-form-group">
            <label className="modal-label">Role</label>
            <select
              className="modal-select"
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }
            >
              <option value="student">Student</option>
              <option value="parent">Parent</option>
              <option value="instructor">Instructor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={formLoading}
            className="modal-btn modal-btn-info"
          >
            {formLoading ? (
              "Saving..."
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk" /> Save Changes
              </>
            )}
          </button>
          {/* Deactivating lives here rather than as a button on every table
              row: it is rare and destructive, and it is confirmed in its own
              dialog. */}
          {editUser?.isActive !== false && (
            <button
              type="button"
              className="modal-btn modal-btn-ghost"
              style={{ marginTop: "0.75rem", color: "var(--error)" }}
              onClick={() => {
                const target = editUser;
                setEditUser(null);
                setFormError(null);
                setDeleteUser(target);
              }}
            >
              <i className="fa-solid fa-user-slash" /> Deactivate this account
            </button>
          )}
        </form>
      </Modal>

      {/* ═══ DELETE MODAL ═══ */}
      <Modal
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        title="Deactivate User"
        size="sm"
      >
        <div className="modal-warning-icon">
          <i className="fa-solid fa-triangle-exclamation" />
        </div>
        <p className="modal-warning-text">
          Are you sure you want to deactivate{" "}
          <strong>{deleteUser?.FullName}</strong>?
        </p>
        <p className="modal-warning-sub">
          This is a soft delete — the user will be marked inactive.
        </p>
        {formError && (
          <div className="modal-error">
            <i className="fa-solid fa-triangle-exclamation" /> {formError}
          </div>
        )}
        <div className="modal-actions">
          <button
            onClick={() => setDeleteUser(null)}
            className="modal-btn modal-btn-ghost"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={formLoading}
            className="modal-btn modal-btn-danger"
          >
            {formLoading ? (
              "Deleting..."
            ) : (
              <>
                <i className="fa-solid fa-trash" /> Delete
              </>
            )}
          </button>
        </div>
      </Modal>

      {/* ═══ ADMIN FORCE-LINK MODAL ═══ */}
      <Modal
        isOpen={!!linkTargetUser}
        onClose={() => setLinkTargetUser(null)}
        title={`Manage connections: ${linkTargetUser?.FullName} (${linkTargetUser?.role})`}
        size="md"
      >
        {linkActionError && (
          <div className="modal-error">
            <i className="fa-solid fa-triangle-exclamation" /> {linkActionError}
          </div>
        )}
        {linkActionSuccess && (
          <div
            style={{
              background: "rgba(16,185,129,0.1)",
              color: "#10b981",
              border: "1px solid #10b981",
              padding: "0.75rem",
              borderRadius: "var(--radius-sm)",
              marginBottom: "1rem",
              fontWeight: 700,
            }}
          >
            <i className="fa-solid fa-circle-check" /> {linkActionSuccess}
          </div>
        )}

        {targetAssignments.length > 0 && (
          <div
            style={{
              marginBottom: "1.25rem",
              padding: "0.85rem",
              border: "2px solid var(--border-color)",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-tertiary)",
            }}
          >
            <h4 style={{ margin: "0 0 0.65rem" }}>
              Active instructor assignments
            </h4>
            <div style={{ display: "grid", gap: "0.55rem" }}>
              {targetAssignments.map((assignment) => (
                <div
                  key={assignment._id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--text-primary)",
                    }}
                  >
                    <strong>
                      {assignment.studentProfileId?.user?.FullName || "Student"}
                    </strong>
                    {" → "}
                    {assignment.instructorId?.FullName || "Instructor"}
                  </span>
                  <button
                    type="button"
                    className="modal-btn modal-btn-danger"
                    style={{
                      width: "auto",
                      padding: "0.35rem 0.65rem",
                      fontSize: "0.72rem",
                    }}
                    disabled={linkActionLoading}
                    onClick={() => handleUnassignInstructor(assignment._id)}
                  >
                    Unassign
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {linkModalType === "parent" && (
          <form onSubmit={handleAdminLinkParent}>
            <p
              style={{
                fontSize: "0.88rem",
                color: "var(--text-muted)",
                marginBottom: "1rem",
              }}
            >
              Select a <strong>Student</strong> to forcefully link to Parent{" "}
              <strong>{linkTargetUser?.FullName}</strong>.
            </p>
            <div className="modal-form-group">
              <label className="modal-label">Select Student</label>
              <select
                className="modal-select"
                required
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                <option value="">-- Choose Student --</option>
                {studentsList
                  .filter((s) => !isAssignedPair(s._id, linkTargetUser?._id))
                  .map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.FullName} (@{s.UserName}) - {s.Email}
                    </option>
                  ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={linkActionLoading || !selectedStudentId}
              className="modal-btn modal-btn-primary"
            >
              {linkActionLoading
                ? "Linking..."
                : "Force-Link Student to Parent"}
            </button>
          </form>
        )}

        {linkModalType === "instructor" && (
          <form onSubmit={handleAdminLinkInstructor}>
            <p
              style={{
                fontSize: "0.88rem",
                color: "var(--text-muted)",
                marginBottom: "1rem",
              }}
            >
              Select a <strong>Student</strong> to assign to Instructor{" "}
              <strong>{linkTargetUser?.FullName}</strong>.
            </p>
            <div className="modal-form-group">
              <label className="modal-label">Select Student</label>
              <select
                className="modal-select"
                required
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
              >
                <option value="">-- Choose Student --</option>
                {studentsList.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.FullName} (@{s.UserName}) - {s.Email}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={linkActionLoading || !selectedStudentId}
              className="modal-btn modal-btn-primary"
            >
              {linkActionLoading
                ? "Assigning..."
                : "Assign Student to Instructor"}
            </button>
          </form>
        )}

        {linkModalType === "student" && (
          <div>
            <p
              style={{
                fontSize: "0.88rem",
                color: "var(--text-muted)",
                marginBottom: "1rem",
              }}
            >
              Manage links for Student{" "}
              <strong>{linkTargetUser?.FullName}</strong>.
            </p>

            <form
              onSubmit={handleAdminLinkParent}
              style={{
                marginBottom: "1.5rem",
                paddingBottom: "1.5rem",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
                Link Parent
              </h4>
              <div className="modal-form-group">
                <select
                  className="modal-select"
                  required
                  value={selectedParentId}
                  onChange={(e) => setSelectedParentId(e.target.value)}
                >
                  <option value="">-- Choose Parent --</option>
                  {parentsList.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.FullName} (@{p.UserName}) - {p.Email}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={linkActionLoading || !selectedParentId}
                className="modal-btn modal-btn-primary"
                style={{ marginTop: "0.5rem" }}
              >
                {linkActionLoading ? "Linking..." : "Link Parent"}
              </button>
            </form>

            <form onSubmit={handleAdminLinkInstructor}>
              <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>
                Assign Instructor
              </h4>
              <div className="modal-form-group">
                <select
                  className="modal-select"
                  required
                  value={selectedInstructorId}
                  onChange={(e) => setSelectedInstructorId(e.target.value)}
                >
                  <option value="">-- Choose Instructor --</option>
                  {instructorsList
                    .filter(
                      (inst) => !isAssignedPair(linkTargetUser?._id, inst._id),
                    )
                    .map((inst) => (
                      <option key={inst._id} value={inst._id}>
                        {inst.FullName} (@{inst.UserName}) - {inst.Email}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={linkActionLoading || !selectedInstructorId}
                className="modal-btn modal-btn-info"
                style={{ marginTop: "0.5rem" }}
              >
                {linkActionLoading ? "Assigning..." : "Assign Instructor"}
              </button>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default UsersPage;
