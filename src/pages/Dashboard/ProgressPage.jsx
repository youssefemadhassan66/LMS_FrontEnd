import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import useFetchData from '../../hooks/useFetchData';
import { useAuth } from '../../context/AuthContext';
import TrendsChart from '../../components/TrendsChart/TrendsChart';
import ReviewRadarChart from '../../components/TrendsChart/ReviewRadarChart';
import ChartTooltip from '../../components/TrendsChart/ChartTooltip';
import { TREND_CONFIGS, buildTrendEndpoint } from '../../components/TrendsChart/trendConfig';
import { SkeletonStatsGrid, SkeletonCardGrid } from '../../components/Skeleton/Skeleton';
import './DashboardOverview.css';
import './Insights.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const periodName = (p) => {
  if (!p) return '';
  if (p.week != null) return `Week ${p.week}, ${p.year}`;
  if (p.month != null) return `${MONTHS[p.month - 1] || p.month} ${p.year}`;
  return String(p.year || '');
};

const initialsOf = (name = '') =>
  name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').toUpperCase().slice(0, 2) || '?';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const oneDecimal = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

// The four headline measures. A section the API returns as null had nothing
// to measure this period (no reviews, no exams), which is not the same as a
// score of zero, so it is shown as a dash with the reason.
const METRICS = [
  {
    key: 'reviews', label: 'Average review', icon: 'fa-solid fa-star', tone: 'var(--data-review)',
    read: (s) => s?.reviews?.avgOverall, max: 5, unit: '/ 5', empty: 'No reviews yet',
  },
  {
    key: 'tasks', label: 'Tasks done', icon: 'fa-solid fa-circle-check', tone: 'var(--data-tasks)',
    read: (s) => s?.tasks?.completionRate, max: 100, unit: '%', empty: 'No tasks this period',
  },
  {
    key: 'attendance', label: 'Attendance', icon: 'fa-solid fa-calendar-check', tone: 'var(--data-attendance)',
    read: (s) => s?.attendance?.attendanceRate, max: 100, unit: '%', empty: 'No classes this period',
  },
  {
    key: 'exams', label: 'Exam average', icon: 'fa-solid fa-pen-to-square', tone: 'var(--data-exams)',
    read: (s) => s?.exams?.avgPercentage, max: 100, unit: '%', empty: 'No exams yet',
  },
];

const Trend = ({ trend, delta }) => {
  const d = isNum(delta) ? oneDecimal(Math.abs(delta)) : null;
  if (trend === 'improving') {
    return <span className="ins-trend is-up"><i className="fa-solid fa-arrow-trend-up" />{d ? `+${d}` : 'Up'}</span>;
  }
  if (trend === 'declining') {
    return <span className="ins-trend is-down"><i className="fa-solid fa-arrow-trend-down" />{d ? `−${d}` : 'Down'}</span>;
  }
  return <span className="ins-trend"><i className="fa-solid fa-minus" />Steady</span>;
};

const MetricCard = ({ metric, snapshot }) => {
  const value = metric.read(snapshot);
  const section = snapshot?.[metric.key];
  const has = isNum(value);
  const pct = has ? Math.min(100, Math.max(0, (value / metric.max) * 100)) : 0;
  return (
    <div className={`ins-metric${has ? '' : ' is-empty'}`} style={{ '--tone': metric.tone }}>
      <p className="ins-metric__label"><i className={metric.icon} />{metric.label}</p>
      <p className="ins-metric__value">
        {has ? oneDecimal(value) : '—'}
        {has && <small>{metric.unit}</small>}
      </p>
      <div className="ins-bar is-thin"><span style={{ width: `${pct}%` }} /></div>
      <div className="ins-metric__foot">
        {has ? <Trend trend={section?.trend} delta={section?.delta} /> : <span>{metric.empty}</span>}
      </div>
    </div>
  );
};

const PeriodSwitch = ({ period, onChange }) => (
  <div className="ins-seg" role="group" aria-label="Period">
    {[['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([value, label]) => (
      <button key={value} type="button" aria-pressed={period === value} onClick={() => onChange(value)}>
        {label}
      </button>
    ))}
  </div>
);

/* ── Admins and instructors: pick a student ── */
const StudentPicker = ({ profiles, loading, onOpen }) => {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return profiles;
    return profiles.filter((p) =>
      `${p.user?.FullName || ''} ${p.user?.Email || ''} ${p.grade || ''}`.toLowerCase().includes(needle));
  }, [profiles, query]);

  return (
    <div className="overview-container">
      <div className="ins-head">
        <div className="ins-head__text">
          <h1 className="page-title">Progress reports</h1>
          <p className="page-subtitle">Choose a student to see their grades, attendance and trends.</p>
        </div>
      </div>

      <div className="ins-toolbar">
        <label className="ins-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email or grade"
            aria-label="Search students"
          />
        </label>
        {!loading && (
          <span className="ins-count">
            {shown.length === profiles.length ? `${profiles.length} students` : `${shown.length} of ${profiles.length} students`}
          </span>
        )}
      </div>

      {loading ? (
        <SkeletonCardGrid count={6} minWidth={260} gap="1rem" />
      ) : profiles.length === 0 ? (
        <div className="ins-panel ins-empty">
          <i className="fa-solid fa-user-graduate" />
          <strong>No students yet</strong>
          <p>Reports appear here once a student profile exists.</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="ins-panel ins-empty">
          <i className="fa-solid fa-magnifying-glass" />
          <strong>No match for “{query}”</strong>
          <p>Try part of a name or a grade.</p>
        </div>
      ) : (
        <div className="ins-cards">
          {shown.map((p) => {
            const name = p.user?.FullName || 'Student';
            return (
              <button key={p._id} type="button" className="ins-card tone-student" onClick={() => onOpen(p._id)}>
                <span className="ins-avatar is-large" aria-hidden="true">{initialsOf(name)}</span>
                <span className="ins-person__text">
                  <strong>{name}</strong>
                  <small>{p.grade || 'No grade set'}</small>
                </span>
                <i className="fa-solid fa-chevron-right ins-card__go" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
const ProgressPage = () => {
  const { user } = useAuth();
  const { profileId } = useParams();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('monthly');

  const role = user?.role;
  const isStaff = role === 'admin' || role === 'instructor';

  let endpoint = '';
  if (profileId) {
    endpoint = `/api/v1/progress/child/${profileId}?period=${period}`;
  } else if (role === 'parent') {
    endpoint = `/api/v1/progress/compare-children`;
  } else if (role === 'student') {
    endpoint = `/api/v1/progress/me?period=${period}`;
  }

  const { data, loading, error } = useFetchData(endpoint || null);

  // Whose report this is. The progress endpoint returns numbers only.
  const { data: profileData } = useFetchData(profileId ? `/api/v1/StudentProfile/${profileId}` : null);

  const { data: profilesData, loading: profilesLoading } = useFetchData(
    // Instructors only see their linked students; admins see all
    isStaff && !profileId
      ? (role === 'instructor' ? '/api/v1/session/me/students' : '/api/v1/StudentProfile/all')
      : null
  );
  const profiles = Array.isArray(profilesData)
    ? profilesData
    : (profilesData?.students || profilesData?.docs || profilesData?.profiles || []);

  if (isStaff && !profileId) {
    return (
      <StudentPicker
        profiles={profiles}
        loading={profilesLoading}
        onOpen={(id) => navigate(`/dashboard/progress/${id}`)}
      />
    );
  }

  if (!endpoint) {
    return (
      <div className="overview-container">
        <h1 className="page-title">Progress reports</h1>
        <div className="ins-panel ins-empty">
          <i className="fa-solid fa-user-graduate" />
          <strong>Choose a student first</strong>
          <p>Open a student profile to see their progress.</p>
          <button className="nb-btn nb-btn-primary" onClick={() => navigate('/dashboard/profiles')} style={{ marginTop: '0.75rem' }}>
            Go to student profiles
          </button>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="overview-container">
      <h1 className="page-title">Progress</h1>
      <p className="page-subtitle">Loading progress…</p>
      <SkeletonStatsGrid count={4} />
      <SkeletonCardGrid count={2} minWidth={340} gap="1.25rem" />
    </div>
  );

  if (error) {
    return (
      <div className="overview-container">
        <h1 className="page-title">Progress</h1>
        <div className="ins-panel ins-empty">
          <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--error)' }} />
          <strong>Could not load this report</strong>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  /* ── Parent: every child side by side ── */
  if (role === 'parent' && !profileId) {
    const children = Array.isArray(data) ? data : (data?.data || []);
    return (
      <div className="overview-container">
        <div className="ins-head">
          <div className="ins-head__text">
            <h1 className="page-title">How your children are doing</h1>
            <p className="page-subtitle">This month at a glance. Open a report for the full picture.</p>
          </div>
        </div>
        {children.length === 0 ? (
          <div className="ins-panel ins-empty">
            <i className="fa-solid fa-children" />
            <strong>No children linked yet</strong>
            <p>Send a link request from your home page to see a child’s progress here.</p>
          </div>
        ) : (
          <div className="ins-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {children.map((c) => {
              const s = c.latestStats || {};
              const rows = [
                { label: 'Average review', value: s.reviewAvgOverall, max: 5, unit: ' / 5', tone: 'var(--data-review)', none: 'No reviews yet' },
                { label: 'Tasks done', value: s.taskCompletionRate, max: 100, unit: '%', tone: 'var(--data-tasks)', none: 'No tasks yet' },
                { label: 'Attendance', value: s.attendanceRate, max: 100, unit: '%', tone: 'var(--data-attendance)', none: 'No classes yet' },
                { label: 'Exam average', value: s.examAvgPercentage, max: 100, unit: '%', tone: 'var(--data-exams)', none: 'No exams yet' },
              ];
              const name = c.child?.fullName || 'Child';
              return (
                <div key={c.child?.profileId || name} className="ins-panel tone-student">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <span className="ins-avatar is-large" aria-hidden="true">{initialsOf(name)}</span>
                    <span className="ins-person__text">
                      <strong style={{ fontSize: '1.05rem' }}>{name}</strong>
                      <small>{c.child?.grade || 'No grade set'}</small>
                    </span>
                  </div>
                  <div className="ins-card__rows">
                    {rows.map((row) => {
                      const has = isNum(row.value);
                      return (
                        <div key={row.label} className="ins-row" style={{ '--tone': row.tone }}>
                          <div>
                            <span>{row.label}</span>
                            {has ? <strong>{oneDecimal(row.value)}{row.unit}</strong> : <span className="is-none">{row.none}</span>}
                          </div>
                          <div className="ins-bar is-thin"><span style={{ width: `${has ? Math.min(100, (row.value / row.max) * 100) : 0}%` }} /></div>
                        </div>
                      );
                    })}
                  </div>
                  <button className="nb-btn nb-btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => navigate(`/dashboard/progress/${c.child?.profileId}`)}>
                    See full report
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     ONE STUDENT
  ══════════════════════════════════════════════════════════════ */
  const snapshot = data?.snapshot || data?.data?.snapshot;
  const trends = data?.trends || data?.data?.trends;
  const profile = profileData?.data || profileData;
  const studentName = profile?.user?.FullName;
  const scope = profileId ? `child/${profileId}` : 'me';

  const title = !profileId ? 'My progress' : (studentName ? `${studentName}’s progress` : 'Student progress');
  const subtitle = [profile?.grade, periodName(snapshot?.currentPeriod)].filter(Boolean).join(' · ');
  const backLabel = role === 'parent' ? 'All children' : 'All students';

  const reviewScore = snapshot?.reviews?.avgOverall;
  const subScore = snapshot?.submissions?.avgScore;
  const subOnTime = snapshot?.submissions?.onTimeRate;

  // Everything on one 0-100 scale; measures with nothing this period are
  // left out rather than drawn as a zero.
  const barData = [
    { name: 'Reviews', value: isNum(reviewScore) ? +(reviewScore * 20).toFixed(1) : null, color: 'var(--data-review)' },
    { name: 'Tasks', value: snapshot?.tasks?.completionRate, color: 'var(--data-tasks)' },
    { name: 'Attendance', value: snapshot?.attendance?.attendanceRate, color: 'var(--data-attendance)' },
    { name: 'Exams', value: snapshot?.exams?.avgPercentage, color: 'var(--data-exams)' },
    { name: 'Homework', value: isNum(subScore) ? +(subScore * 10).toFixed(1) : null, color: 'var(--data-score)' },
    { name: 'On time', value: subOnTime, color: 'var(--data-ontime)' },
  ].filter((d) => isNum(d.value));

  const trendEntries = Object.entries(TREND_CONFIGS).map(([key, cfg]) => {
    const rows = Array.isArray(trends?.[key]) ? trends[key] : null;
    const has = rows ? rows.some((r) => cfg.metrics.some((m) => r[m.key] != null)) : true;
    return { key, cfg, rows, has };
  });
  const charted = trendEntries.filter((t) => t.has);
  const uncharted = trendEntries.filter((t) => !t.has);

  return (
    <div className="overview-container">
      <div className="ins-head">
        <div className="ins-head__text">
          {profileId && role !== 'student' && (
            <button type="button" className="ins-back" onClick={() => navigate('/dashboard/progress')}>
              <i className="fa-solid fa-arrow-left" /> {backLabel}
            </button>
          )}
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        <PeriodSwitch period={period} onChange={setPeriod} />
      </div>

      {barData.length === 0 ? (
        <div className="ins-panel ins-empty">
          <i className="fa-solid fa-seedling" />
          <strong>Nothing to report yet</strong>
          <p>Numbers appear here after the first classes, tasks and reviews.</p>
        </div>
      ) : (
        <>
          <div className="ins-metrics">
            {METRICS.map((m) => <MetricCard key={m.key} metric={m} snapshot={snapshot} />)}
          </div>

          <div className="ins-grid-2">
            <div className="ins-panel">
              <div className="ins-panel__head">
                <h3><i className="fa-solid fa-chart-column" />This period at a glance</h3>
                <span className="ins-panel__meta">out of 100</span>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={34}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={<ChartTooltip format={(v) => `${oneDecimal(v)} / 100`} />}
                    cursor={{ fill: 'var(--bg-tertiary)', opacity: 0.5 }}
                  />
                  <Bar dataKey="value" name="Score" radius={[8, 8, 0, 0]}>
                    {barData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="ins-panel__meta" style={{ margin: '0.6rem 0 0' }}>
                Reviews (out of 5) and homework scores (out of 10) are scaled to 100 so they sit on one chart.
              </p>
            </div>

            <ReviewRadarChart
              endpoint={`/api/v1/progress/${scope}/reviews/radar`}
              title="Teacher review breakdown"
              icon="fa-solid fa-star-half-stroke"
            />
          </div>

          {isNum(subScore) && (
            <div className="ins-panel" style={{ '--tone': 'var(--data-score)' }}>
              <div className="ins-panel__head">
                <h3><i className="fa-solid fa-clipboard-list" />Homework</h3>
                <Trend trend={snapshot.submissions?.trend} delta={snapshot.submissions?.scoreDelta} />
              </div>
              <div className="ins-grid-2">
                <div>
                  <div className="ins-figure"><span>Average score</span><strong>{oneDecimal(subScore)}<small style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}> / 10</small></strong></div>
                  <div className="ins-bar"><span style={{ width: `${Math.min(100, subScore * 10)}%` }} /></div>
                </div>
                {isNum(subOnTime) && (
                  <div style={{ '--tone': 'var(--data-ontime)' }}>
                    <div className="ins-figure"><span>Handed in on time</span><strong>{oneDecimal(subOnTime)}%</strong></div>
                    <div className="ins-bar"><span style={{ width: `${Math.min(100, subOnTime)}%` }} /></div>
                  </div>
                )}
              </div>
            </div>
          )}

          <section aria-labelledby="trends-title" style={{ display: 'grid', gap: '1rem' }}>
            <h2 id="trends-title" className="ins-section-title">
              <i className="fa-solid fa-chart-line" /> Over time
            </h2>
            {charted.length > 0 && (
              <div className="ins-grid-2 ins-grid-fill">
                {charted.map(({ key, cfg, rows }) => (
                  <TrendsChart
                    key={key}
                    rows={rows || undefined}
                    endpoint={rows ? undefined : buildTrendEndpoint(scope, cfg.suffix, period)}
                    title={cfg.title}
                    icon={cfg.icon}
                    metrics={cfg.metrics}
                    yDomain={cfg.yDomain}
                  />
                ))}
              </div>
            )}
            {uncharted.length > 0 && (
              <p className="ins-note">
                <i className="fa-solid fa-circle-info" />
                <span>
                  <strong>No history yet for {uncharted.map((t) => t.cfg.short).join(', ')}.</strong>{' '}
                  These charts appear once there is something to plot.
                </span>
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default ProgressPage;
