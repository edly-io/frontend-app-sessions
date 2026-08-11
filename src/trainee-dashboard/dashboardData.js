export const trainee = {
  firstName: 'Ayesha',
  rollNumber: 'STP-50-014',
  programme: 'Specialised Training Programme',
  batch: '50th STP',
  campus: 'Lahore Campus',
  day: 96,
  totalDays: 180,
  endDate: '27 Oct 2026',
};

export const courses = [
  {
    code: 'TX-101', name: 'Income Tax Law & Practice', instructor: 'Ayesha Khan', completed: 5, total: 5,
  },
  {
    code: 'TX-102', name: 'Sales Tax & Federal Excise', instructor: 'Bilal Ahmed', completed: 3, total: 4,
  },
  {
    code: 'AC-110', name: 'Accounting & Financial Analysis', instructor: 'Sana Malik', completed: 4, total: 4,
  },
  {
    code: 'AU-120', name: 'Audit Techniques & Assurance', instructor: 'Usman Raza', completed: 2, total: 4,
  },
  {
    code: 'IT-130', name: 'Information Systems (IRIS)', instructor: 'Hina Sheikh', completed: 1, total: 5,
  },
];

export const sessions = [
  {
    day: 6, month: 'Aug', dayLabel: 'Today', time: '09:30', duration: '2 hrs', title: 'Withholding Tax Regime — Practical Cases', course: 'TX-101', instructor: 'Ayesha Khan', mode: 'On-site', location: 'Lecture Hall B', featured: true,
  },
  {
    day: 6, month: 'Aug', time: '14:00', duration: '1.5 hrs', title: 'Input & Output Tax Adjustments', course: 'TX-102', instructor: 'Bilal Ahmed', mode: 'Online', location: 'Zoom',
  },
  {
    day: 7, month: 'Aug', time: '10:00', duration: '3 hrs', title: 'Audit Sampling Workshop', course: 'AU-120', instructor: 'Usman Raza', mode: 'On-site', location: 'Computer Lab 2',
  },
  {
    day: 10, month: 'Aug', time: '09:00', duration: '2 hrs', title: 'IRIS e-Filing Walkthrough', course: 'IT-130', instructor: 'Hina Sheikh', mode: 'Online', location: 'MS Teams',
  },
];

export const attendance = {
  present: 38,
  absent: 4,
  leave: 2,
  threshold: 75,
  history: [
    { date: '05 Aug', name: 'Withholding Tax Regime — TX-101', status: 'Present' },
    { date: '04 Aug', name: 'Federal Excise Duty — TX-102', status: 'Present' },
    { date: '03 Aug', name: 'Audit Risk Assessment — AU-120', status: 'On leave' },
    { date: '31 Jul', name: 'Cash Flow Analysis — AC-110', status: 'Present' },
    { date: '30 Jul', name: 'IRIS Data Validation — IT-130', status: 'Absent' },
  ],
};

export const feedback = [
  {
    instructor: 'Hina Sheikh', course: 'Information Systems (IRIS)', due: '08 Aug 2026', urgent: true,
  },
  { instructor: 'Usman Raza', course: 'Audit Techniques & Assurance', due: '12 Aug 2026' },
  { instructor: 'Bilal Ahmed', course: 'Sales Tax & Federal Excise', due: '15 Aug 2026' },
  { instructor: 'Ayesha Khan', course: 'Income Tax Law & Practice', submitted: true },
];

export const holidays = [
  {
    day: 14, month: 'Aug', name: 'Independence Day', note: 'Campus closed',
  },
  {
    day: 19, month: 'Aug', name: 'Mid-programme break', note: 'No sessions · 3 days', observed: true,
  },
  {
    day: 26, month: 'Aug', name: 'Chehlum', note: 'Campus closed',
  },
  {
    day: 25, month: 'Sep', name: 'Eid Milad-un-Nabi', note: 'Campus closed',
  },
];

export const certificates = [
  {
    title: 'Course Completion — Income Tax Law & Practice', programme: 'TX-101 · 50th STP', number: 'FBR-CERT-500141', date: '28 Jul 2026', earned: true,
  },
  {
    title: 'Course Completion — Accounting & Financial Analysis', programme: 'AC-110 · 50th STP', number: 'FBR-CERT-500142', date: '22 Jul 2026', earned: true,
  },
  {
    title: 'Programme Completion Certificate', programme: '50th STP · Lahore Campus', requirement: 'Awarded once all courses are complete and results are finalized.', earned: false,
  },
];

export const totals = {
  completedModules: courses.reduce((sum, course) => sum + course.completed, 0),
  modules: courses.reduce((sum, course) => sum + course.total, 0),
  pendingFeedback: feedback.filter(item => !item.submitted).length,
  certificates: certificates.filter(item => item.earned).length,
};

export const attendancePercentage = Math.round(
  (attendance.present / (attendance.present + attendance.absent + attendance.leave)) * 100,
);

export const courseProgress = Math.round((totals.completedModules / totals.modules) * 100);
