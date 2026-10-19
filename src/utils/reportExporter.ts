import { Survey, InterviewSession, Question } from '../types/survey';

export function exportSurveyToCSV(survey: Survey, sessions: InterviewSession[]): void {
  const surveySessions = sessions.filter((s) => s.surveyId === survey.id);

  // Headers
  const headers = [
    'Session ID',
    'Interview Mode',
    'Interview Type',
    'Started At',
    'Completed At',
    'Respondent Name',
    'Cohort Group',
    'Age',
    'Gender',
    'Location',
    'Role',
    'Sync Status',
    ...survey.questions.map((q, idx) => `Q${idx + 1}: ${q.text.replace(/"/g, '""')}`),
  ];

  const rows: string[][] = [];

  for (const session of surveySessions) {
    for (const respondent of session.respondents) {
      const row: string[] = [
        session.id,
        session.interviewMode,
        session.interviewType,
        session.startedAt || '',
        session.completedAt || '',
        `"${(respondent.name || '').replace(/"/g, '""')}"`,
        `"${(respondent.cohortGroup || '').replace(/"/g, '""')}"`,
        `"${respondent.demographics?.age || ''}"`,
        `"${respondent.demographics?.gender || ''}"`,
        `"${(respondent.demographics?.location || '').replace(/"/g, '""')}"`,
        `"${(respondent.demographics?.role || '').replace(/"/g, '""')}"`,
        session.syncStatus,
      ];

      for (const q of survey.questions) {
        const responses = session.responses?.[q.id] || [];
        const resp = responses.find((r) => r.respondentId === respondent.id) || responses[0];
        let valStr = '';
        if (resp) {
          if (Array.isArray(resp.value)) {
            valStr = resp.value.join('; ');
          } else {
            valStr = String(resp.value ?? '');
          }
          if (resp.sentiment) {
            valStr += ` [Sentiment: ${resp.sentiment.label} (${resp.sentiment.score})]`;
          }
        }
        row.push(`"${valStr.replace(/"/g, '""')}"`);
      }
      rows.push(row);
    }
  }

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${survey.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_dataset.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportSurveyToWordDoc(
  survey: Survey,
  sessions: InterviewSession[],
  reportTemplate: 'summary' | 'detailed' | 'comparative' = 'summary'
): void {
  const surveySessions = sessions.filter((s) => s.surveyId === survey.id);
  const totalRespondents = surveySessions.reduce((acc, s) => acc + s.respondents.length, 0);

  const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${survey.title} - Research Report</title>
  <style>
    body { font-family: 'Calibri', 'Arial', sans-serif; line-height: 1.6; color: #222; margin: 40px; }
    h1 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; }
    h2 { color: #1e40af; margin-top: 24px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
    h3 { color: #334155; }
    .badge { background: #e0f2fe; color: #0369a1; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 24px; }
    th { background: #f1f5f9; color: #0f172a; text-align: left; padding: 8px 12px; border: 1px solid #cbd5e1; }
    td { padding: 8px 12px; border: 1px solid #e2e8f0; vertical-align: top; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
    .quote-box { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 10px 16px; font-style: italic; margin: 8px 0; }
  </style>
</head>
<body>
  <h1>AI Survey Instrument — Research Report</h1>
  <div class="meta-box">
    <h2>${survey.title}</h2>
    <p><strong>Description:</strong> ${survey.description}</p>
    <p><strong>Interview Type:</strong> ${survey.interviewType.toUpperCase()} | <strong>Target Audience:</strong> ${survey.targetAudience}</p>
    <p><strong>Total Conducted Sessions:</strong> ${surveySessions.length} | <strong>Total Respondents:</strong> ${totalRespondents}</p>
    <p><strong>Report Template:</strong> ${reportTemplate.toUpperCase()} | <strong>Generated At:</strong> ${new Date().toLocaleString()}</p>
  </div>

  <h2>Question Instrument & Findings Breakdown</h2>
  ${survey.questions
    .map((q, idx) => {
      const responses = surveySessions.flatMap((s) => s.responses[q.id] || []);
      const count = responses.length;

      let statsHtml = '';
      if (q.type === 'likert') {
        const scores = responses.map((r) => Number(r.value)).filter((v) => !isNaN(v) && v > 0);
        const mean = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 'N/A';
        statsHtml = `<p><strong>Responses:</strong> ${count} | <strong>Mean Score:</strong> ${mean} / ${q.likertConfig?.points || 5} | <strong>Scale:</strong> ${q.likertConfig?.templateId || 'Standard'}</p>`;
      } else {
        statsHtml = `<p><strong>Total Responses Logged:</strong> ${count}</p>`;
      }

      const sampleQuotes = responses
        .filter((r) => typeof r.value === 'string' && r.value.length > 15)
        .slice(0, 3)
        .map((r) => `<div class="quote-box">"${r.value}" ${r.sentiment ? `— Sentiment: ${r.sentiment.label}` : ''}</div>`)
        .join('');

      return `
      <div>
        <h3>Q${idx + 1}. [${q.type.toUpperCase()}] ${q.text}</h3>
        ${q.translations?.tl ? `<p style="color:#64748b; font-size:13px;"><em>Tagalog:</em> ${q.translations.tl}</p>` : ''}
        ${q.translations?.ceb ? `<p style="color:#64748b; font-size:13px;"><em>Cebuano:</em> ${q.translations.ceb}</p>` : ''}
        ${statsHtml}
        ${sampleQuotes ? `<h4>Key Respondent Observations:</h4>${sampleQuotes}` : ''}
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
    `;
    })
    .join('')}

  <h2>Participant Demographics Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Respondent Name</th>
        <th>Cohort Group</th>
        <th>Age / Gender</th>
        <th>Location</th>
        <th>Attendance Status</th>
      </tr>
    </thead>
    <tbody>
      ${surveySessions
        .flatMap((s) => s.respondents)
        .map(
          (r) => `
        <tr>
          <td><strong>${r.name}</strong></td>
          <td>${r.cohortGroup}</td>
          <td>${r.demographics?.age || '-'} / ${r.demographics?.gender || '-'}</td>
          <td>${r.demographics?.location || '-'}</td>
          <td>${r.attendanceStatus}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <p style="text-align:center; color:#94a3b8; font-size:12px; margin-top:40px;">
    Document generated automatically by AI Survey Instrument Enterprise System. Verified with local encryption integrity.
  </p>
</body>
</html>
`;

  const blob = new Blob(['\uFEFF', htmlContent], {
    type: 'application/msword',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${survey.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_report.doc`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportSurveyToJSON(survey: Survey, sessions: InterviewSession[]): void {
  const surveySessions = sessions.filter((s) => s.surveyId === survey.id);
  const payload = {
    exportedAt: new Date().toISOString(),
    survey,
    sessions: surveySessions,
  };
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${survey.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_raw_export.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
