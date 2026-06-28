import type { JSX } from 'react';
import { Card, Skeleton } from '@ermulaku/ui';
import {
  useGetAnalyticsSummaryQuery,
  useGetLessonsByDayOfWeekQuery,
  useGetLessonsOverTimeQuery,
  useGetStudentMixQuery,
  useGetTopSubjectsQuery,
} from '../../store/api';
import { AreaChart } from '../../components/AreaChart';
import { BarChart } from '../../components/BarChart';

export function AnalyticsScreen(): JSX.Element {
  const { data: summary, isLoading } = useGetAnalyticsSummaryQuery();
  const { data: overTime } = useGetLessonsOverTimeQuery();
  const { data: topSubjects } = useGetTopSubjectsQuery();
  const { data: byDay } = useGetLessonsByDayOfWeekQuery();
  const { data: mix } = useGetStudentMixQuery();

  if (isLoading || !summary) return <Skeleton height={320} />;

  return (
    <div className="analytics">
      <div className="kpi-row">
        <Card className="earn__stat">
          <div className="earn__stat-label">Lessons this month</div>
          <div className="earn__stat-value">{summary.lessonsThisMonth}</div>
        </Card>
        <Card className="earn__stat">
          <div className="earn__stat-label">New students</div>
          <div className="earn__stat-value">{summary.newStudents}</div>
        </Card>
        <Card className="earn__stat">
          <div className="earn__stat-label">Repeat rate</div>
          <div className="earn__stat-value">{summary.repeatRatePct}%</div>
        </Card>
        <Card className="earn__stat">
          <div className="earn__stat-label">Utilization</div>
          <div className="earn__stat-value">{summary.utilizationPct}%</div>
        </Card>
      </div>

      <div className="analytics__row">
        <Card>
          <h3 className="card-head__title">Lessons over time</h3>
          {overTime && <AreaChart points={overTime.map((m) => ({ label: m.month, value: m.count }))} />}
        </Card>
        <Card>
          <h3 className="card-head__title">Top subjects</h3>
          <div className="topsubs">
            {topSubjects?.map((s) => (
              <div key={s.name} className="topsubs__row">
                <span className="topsubs__name">{s.name}</span>
                <div className="topsubs__track">
                  <div className="topsubs__fill" style={{ width: `${String(s.pct)}%` }} />
                </div>
                <span className="muted topsubs__pct">{s.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="analytics__row">
        <Card>
          <h3 className="card-head__title">Lessons by day of week</h3>
          {byDay && (
            <BarChart
              bars={byDay.map((d) => ({ label: d.day, value: d.count }))}
              format={(v) => String(v)}
            />
          )}
        </Card>
        <Card>
          <h3 className="card-head__title">Student mix</h3>
          {mix && (
            <>
              <div className="splitbar">
                <div className="splitbar__seg splitbar__seg--ret" style={{ width: `${String(mix.returningPct)}%` }} />
                <div className="splitbar__seg splitbar__seg--new" style={{ width: `${String(mix.newPct)}%` }} />
              </div>
              <div className="splitbar__legend">
                <span>
                  <i className="splitbar__dot splitbar__dot--ret" /> Returning {mix.returningPct}%
                </span>
                <span>
                  <i className="splitbar__dot splitbar__dot--new" /> New {mix.newPct}%
                </span>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
