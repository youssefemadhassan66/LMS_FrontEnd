import React, { useCallback, useState, useEffect } from "react";
import Modal from "../../components/Modal/Modal";
import Pagination from "../../components/Pagination/Pagination";
import { useApiRequest } from "../../hooks/useApiRequest";
import { SkeletonTableRows } from "../../components/Skeleton/Skeleton";
import useMediaQuery from "../../hooks/useMediaQuery";

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

// Menu items in the mobile row menu are full-width and left-aligned, so the
// menu reads as a list rather than a cluster of pill buttons.
const rowMenuItemStyle = {
  width: "100%",
  justifyContent: "flex-start",
  padding: "0.55rem 0.7rem",
  fontSize: "0.85rem",
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
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

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
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const data = await request(`/api/v1/user?${params.toString()}`);
      const list = data.data?.docs || data.data?.users || data.data || [];
      const arr = Array.isArray(list) ? list : [];
      setUsers(arr);
      setTotalDocs(
        data.data?.total || data.totalDocs || data.results || arr.length,
      );
      setTotalPages(data.data?.totalPages || data.totalPages || 1);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit, page, request]);

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
    <div style={{ padding: "2rem 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "2rem",
              margin: 0,
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
            }}
          >
            <i
              className="fa-solid fa-users"
              style={{
                color: "#6366f1",
                marginRight: "0.5rem",
                fontSize: "1.6rem",
              }}
            />
            User Management
          </h1>
          <p
            style={{
              color: "var(--text-muted)",
              margin: "0.25rem 0 0",
              fontWeight: 600,
            }}
          >
            {users.length} registered users
          </p>
        </div>
        <button
          onClick={() => {
            setFormData(emptyForm);
            setFormError(null);
            setShowCreate(true);
          }}
          className="nb-btn nb-btn-primary"
          style={{ padding: "0.65rem 1.4rem" }}
        >
          <i
            className="fa-solid fa-user-plus"
            style={{ marginRight: "0.4rem" }}
          />{" "}
          Add User
        </button>
      </div>

      {error && <p style={{ color: "var(--error)" }}>{error}</p>}
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
            borderRadius: "1rem",
            marginBottom: "1.5rem",
            overflow: "hidden",
            border: "1px solid #f59e0b66",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "1rem 1.25rem",
              background: "rgba(245,158,11,0.1)",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                <i
                  className="fa-solid fa-user-clock"
                  style={{ color: "#d97706", marginRight: "0.5rem" }}
                />
                Pending account approvals
              </h2>
              <p
                style={{
                  margin: "0.25rem 0 0",
                  color: "var(--text-muted)",
                  fontSize: "0.85rem",
                }}
              >
                These new student and parent accounts cannot access the
                dashboard yet.
              </p>
            </div>
            <span
              className="modal-badge"
              style={{
                background: "#fff7ed",
                color: "#d97706",
                border: "1px solid #f59e0b66",
                fontWeight: 700,
              }}
            >
              {pendingApprovals.length} waiting
            </span>
          </div>
          <div
            style={{ display: "grid", gap: "0.75rem", padding: "1rem 1.25rem" }}
          >
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
                <div>
                  <strong>{pendingUser.FullName}</strong>
                  <span
                    style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
                  >
                    {" "}
                    · {pendingUser.Email} · {pendingUser.role}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    className="modal-btn modal-btn-danger"
                    style={{ width: "auto", padding: "0.45rem 0.75rem" }}
                    disabled={approvalActionId === pendingUser._id}
                    onClick={() =>
                      handleApprovalReview(pendingUser._id, "rejected")
                    }
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="modal-btn modal-btn-primary"
                    style={{ width: "auto", padding: "0.45rem 0.75rem" }}
                    disabled={approvalActionId === pendingUser._id}
                    onClick={() =>
                      handleApprovalReview(pendingUser._id, "approved")
                    }
                  >
                    {approvalActionId === pendingUser._id
                      ? "Saving..."
                      : "Approve"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Users Table — desktop only; phones get the card list below. */}
      {!isMobile && (
      <div
        className="glass-panel"
        style={{ borderRadius: "1rem", overflow: "hidden" }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.92rem",
          }}
        >
          <thead>
            <tr
              style={{
                background: "var(--table-header-bg)",
                borderBottom: "2px solid var(--border-color)",
                textAlign: "left",
              }}
            >
              <th
                style={{
                  padding: "1rem 1.5rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: "0.75rem",
                  letterSpacing: "0.05em",
                }}
              >
                User
              </th>
              <th
                style={{
                  padding: "1rem 1.5rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: "0.75rem",
                  letterSpacing: "0.05em",
                }}
              >
                Email
              </th>
              <th
                style={{
                  padding: "1rem 1.5rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: "0.75rem",
                  letterSpacing: "0.05em",
                }}
              >
                Role
              </th>
              <th
                style={{
                  padding: "1rem 1.5rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: "0.75rem",
                  letterSpacing: "0.05em",
                }}
              >
                Status
              </th>
              <th
                style={{
                  padding: "1rem 1.5rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: "0.75rem",
                  letterSpacing: "0.05em",
                  textAlign: "right",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonTableRows cols={5} rows={5} />}
            {!loading &&
              users.map((u) => {
                const initials = (u.FullName || "U")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                const avatarColor = roleAvatarBg[u.role] || "#10b981";
                return (
                  <tr
                    key={u._id}
                    style={{
                      borderBottom: "1px solid var(--border-color)",
                      background: "var(--card-bg)",
                    }}
                  >
                    <td style={{ padding: "1rem 1.5rem" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <div
                          className="modal-profile-avatar"
                          style={{
                            width: "36px",
                            height: "36px",
                            fontSize: "0.85rem",
                            borderRadius: "10px",
                            background: avatarColor,
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <div
                            style={{
                              fontWeight: 700,
                              color: "var(--text-primary)",
                            }}
                          >
                            {u.FullName}
                          </div>
                          <div
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--text-muted)",
                              fontWeight: 600,
                            }}
                          >
                            @{u.UserName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "1rem 1.5rem",
                        color: "var(--text-secondary)",
                        fontWeight: 555,
                      }}
                    >
                      {u.Email}
                    </td>
                    <td style={{ padding: "1rem 1.5rem" }}>
                      {roleBadge(u.role)}
                    </td>
                    <td style={{ padding: "1rem 1.5rem" }}>
                      {accountStatusBadge(u)}
                    </td>
                    <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        {canManageConnections(u) && u.role === "parent" && (
                          <button
                            onClick={() => openLinkModal(u, "parent")}
                            className="modal-btn"
                            style={{
                              padding: "0.4rem 0.8rem",
                              fontSize: "0.8rem",
                              width: "auto",
                              background: "rgba(139,92,246,0.15)",
                              color: "#8b5cf6",
                              border: "1px solid #8b5cf666",
                            }}
                          >
                            <i className="fa-solid fa-link" /> Link Student
                          </button>
                        )}
                        {canManageConnections(u) && u.role === "instructor" && (
                          <button
                            onClick={() => openLinkModal(u, "instructor")}
                            className="modal-btn"
                            style={{
                              padding: "0.4rem 0.8rem",
                              fontSize: "0.8rem",
                              width: "auto",
                              background: "rgba(59,130,246,0.15)",
                              color: "#3b82f6",
                              border: "1px solid #3b82f666",
                            }}
                          >
                            <i className="fa-solid fa-link" /> Assign Student
                          </button>
                        )}
                        {canManageConnections(u) && u.role === "student" && (
                          <button
                            onClick={() => openLinkModal(u, "student")}
                            className="modal-btn"
                            style={{
                              padding: "0.4rem 0.8rem",
                              fontSize: "0.8rem",
                              width: "auto",
                              background: "rgba(16,185,129,0.15)",
                              color: "#10b981",
                              border: "1px solid #10b98166",
                            }}
                          >
                            <i className="fa-solid fa-link" /> Manage Links
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(u)}
                          className="modal-btn modal-btn-info"
                          style={{
                            padding: "0.4rem 0.8rem",
                            fontSize: "0.8rem",
                            width: "auto",
                          }}
                        >
                          <i className="fa-solid fa-pen" /> Edit
                        </button>
                        {u.isActive !== false && (
                          <button
                            onClick={() => setDeleteUser(u)}
                            className="modal-btn modal-btn-danger"
                            style={{
                              padding: "0.4rem 0.8rem",
                              fontSize: "0.8rem",
                              width: "auto",
                            }}
                          >
                            <i className="fa-solid fa-trash" /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            {!loading && users.length === 0 && (
              <tr>
                <td
                  colSpan="5"
                  style={{
                    padding: "3rem",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontWeight: 600,
                  }}
                >
                  <i
                    className="fa-solid fa-folder-open"
                    style={{
                      fontSize: "2rem",
                      display: "block",
                      marginBottom: "0.5rem",
                      color: "#a1a1aa",
                    }}
                  />
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Users as cards — phones. Every column the table showed is still here,
          stacked, with the row actions behind a menu so nothing overflows. */}
      {isMobile && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {loading && (
            <div
              className="glass-panel"
              style={{
                borderRadius: "1rem",
                padding: "2rem",
                textAlign: "center",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              Loading users...
            </div>
          )}

          {!loading && users.length === 0 && (
            <div
              className="glass-panel"
              style={{
                borderRadius: "1rem",
                padding: "2.5rem 1rem",
                textAlign: "center",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              <i
                className="fa-solid fa-folder-open"
                style={{
                  fontSize: "2rem",
                  display: "block",
                  marginBottom: "0.5rem",
                  color: "#a1a1aa",
                }}
              />
              No users found.
            </div>
          )}

          {!loading &&
            users.map((u) => {
              const initials = (u.FullName || "U")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              const avatarColor = roleAvatarBg[u.role] || "#10b981";
              const menuOpen = openMenuId === u._id;
              const linkType =
                canManageConnections(u) &&
                ["parent", "instructor", "student"].includes(u.role)
                  ? u.role
                  : null;
              const linkLabel = {
                parent: "Link Student",
                instructor: "Assign Student",
                student: "Manage Links",
              }[linkType];

              return (
                <div
                  key={u._id}
                  className="glass-panel"
                  style={{
                    borderRadius: "1rem",
                    padding: "0.9rem 1rem",
                    display: "grid",
                    gap: "0.7rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                    }}
                  >
                    <div
                      className="modal-profile-avatar"
                      style={{
                        width: "40px",
                        height: "40px",
                        fontSize: "0.9rem",
                        borderRadius: "10px",
                        background: avatarColor,
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>

                    {/* minWidth 0 so a long email wraps instead of forcing the
                        row wider than the card. */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {u.FullName}
                      </div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                        }}
                      >
                        @{u.UserName}
                      </div>
                      <div
                        style={{
                          fontSize: "0.82rem",
                          color: "var(--text-secondary)",
                          fontWeight: 555,
                          marginTop: "0.3rem",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {u.Email}
                      </div>
                    </div>

                    <div data-user-menu style={{ flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(menuOpen ? null : u._id)}
                        className="modal-btn"
                        aria-label={`Actions for ${u.FullName}`}
                        aria-expanded={menuOpen}
                        style={{
                          width: "36px",
                          height: "36px",
                          padding: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <i className="fa-solid fa-ellipsis-vertical" />
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.4rem",
                      alignItems: "center",
                    }}
                  >
                    {roleBadge(u.role)}
                    {accountStatusBadge(u)}
                  </div>

                  {menuOpen && (
                    <div
                      data-user-menu
                      role="menu"
                      style={{
                        display: "grid",
                        gap: "0.35rem",
                        paddingTop: "0.7rem",
                        borderTop: "1px solid var(--border-color)",
                      }}
                    >
                      {linkType && (
                        <button
                          role="menuitem"
                          onClick={() => {
                            setOpenMenuId(null);
                            openLinkModal(u, linkType);
                          }}
                          className="modal-btn"
                          style={rowMenuItemStyle}
                        >
                          <i className="fa-solid fa-link" /> {linkLabel}
                        </button>
                      )}
                      <button
                        role="menuitem"
                        onClick={() => {
                          setOpenMenuId(null);
                          openEdit(u);
                        }}
                        className="modal-btn modal-btn-info"
                        style={rowMenuItemStyle}
                      >
                        <i className="fa-solid fa-pen" /> Edit
                      </button>
                      {u.isActive !== false && (
                        <button
                          role="menuitem"
                          onClick={() => {
                            setOpenMenuId(null);
                            setDeleteUser(u);
                          }}
                          className="modal-btn modal-btn-danger"
                          style={rowMenuItemStyle}
                        >
                          <i className="fa-solid fa-trash" /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {!loading && users.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
          total={totalDocs}
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
              placeholder="john@example.com"
              value={formData.Email}
              onChange={(e) =>
                setFormData({ ...formData, Email: e.target.value })
              }
            />
          </div>
          <div className="modal-form-group">
            <label className="modal-label">Password</label>
            <input
              className="modal-input"
              type="password"
              required
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
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
              placeholder="Leave empty to keep"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
            />
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
        </form>
      </Modal>

      {/* ═══ DELETE MODAL ═══ */}
      <Modal
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        title="Delete User"
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
