import http from 'k6/http';
import { check, sleep } from 'k6/';
import { Counter, Trend } from 'k6/metrics';
import { getBaseUrls } from '../lib/config';
import {
  generateApplicationData,
  handleError,
  getAuthHeaders,
  loginAndGetToken,
  generateUUID,
} from '../lib/helpers';

const urls = getBaseUrls();

export const presignedUrlSuccess = new Counter('document_presigned_url_success');
export const uploadConfirmSuccess = new Counter('document_upload_confirm_success');
export const documentListSuccess = new Counter('document_list_success');
export const documentGetSuccess = new Counter('document_get_success');
export const documentReviewSuccess = new Counter('document_review_success');
export const checklistCreateSuccess = new Counter('document_checklist_create_success');
export const documentStatsSuccess = new Counter('document_stats_success');

export const presignedUrlDuration = new Trend('document_presigned_url_duration');
export const uploadConfirmDuration = new Trend('document_upload_confirm_duration');

const createdApps: string[] = [];
const createdDocIds: string[] = [];

const documentTypes = [
  'PAN_CARD', 'AADHAAR_CARD', 'BANK_STATEMENT', 'SALARY_SLIP',
  'ITR', 'FORM_16', 'ADDRESS_PROOF', 'PHOTO', 'SIGNATURE',
  'PROPERTY_DOCUMENT', 'VECHICLE_RC', 'GOLD_HALLMARK', 'EDUCATION_CERTIFICATE',
];

export function scenarios() {
  const vu = __VU;
  const vuMod = vu % 8;

  const officerToken = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const token = officerToken.token;

  if (vuMod === 0) {
    testGetPresignedUrl(token);
  } else if (vuMod === 1) {
    testConfirmUpload(token);
  } else if (vuMod === 2) {
    testDocumentUploadFlow(token);
  } else if (vuMod === 3) {
    testListDocuments(token);
  } else if (vuMod === 4) {
    testDocumentReview(token);
  } else if (vuMod === 5) {
    testDocumentStats(token);
  } else if (vuMod === 6) {
    testDocumentReviewHistory(token);
  } else {
    testCreateChecklist(token);
  }

  sleep(0.5 + Math.random() * 1.5);
}

async function ensureApplication(token: string): Promise<string> {
  if (createdApps.length > 0 && Math.random() > 0.3) {
    return createdApps[Math.floor(Math.random() * createdApps.length)];
  }
  const data = generateApplicationData();
  const res = await http.post(
    `${urls.loan}/api/applications`,
    JSON.stringify(data),
    { headers: getAuthHeaders(token) },
  );
  if (res.status === 201) {
    const body = res.json() as any;
    createdApps.push(body.id);
    return body.id;
  }
  return createdApps.length > 0 ? createdApps[0] : '';
}

export function testGetPresignedUrl(token: string) {
  let appId: string;
  try {
    appId = ensureApplication(token);
  } catch {
    return;
  }
  if (!appId) return;

  const documentType = documentTypes[Math.floor(Math.random() * documentTypes.length)];
  const contentTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  const contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
  const fileSize = 102400 + Math.floor(Math.random() * 1024000);

  const res = http.post(
    `${urls.document}/api/documents/presigned-url`,
    JSON.stringify({
      applicationId: appId,
      documentType,
      fileName: `document_${Date.now()}.pdf`,
      contentType,
      fileSizeBytes: fileSize,
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'document/presigned-url' },
    },
  );

  presignedUrlDuration.add(res.timings.duration);
  handleError(res, 'Presigned URL');

  check(res, {
    'presigned url returns 201': (r) => r.status === 201,
    'returns uploadId': (r) => {
      const b = r.json() as any;
      return b && !!b.uploadId;
    },
    'returns uploadUrl': (r) => {
      const b = r.json() as any;
      return b && !!b.uploadUrl;
    },
    'returns objectKey': (r) => {
      const b = r.json() as any;
      return b && !!b.objectKey;
    },
    'returns expiresIn': (r) => {
      const b = r.json() as any;
      return b && typeof b.expiresIn === 'number';
    },
  });

  if (res.status === 201) {
    const body = res.json() as any;
    if (body.uploadId) {
      createdDocIds.push(body.uploadId);
    }
    presignedUrlSuccess.add(1);
  }
}

export function testConfirmUpload(token: string) {
  let appId: string;
  try {
    appId = ensureApplication(token);
  } catch {
    return;
  }
  if (!appId) return;

  const uploadId = `upload-${generateUUID()}`;
  const documentType = documentTypes[Math.floor(Math.random() * documentTypes.length)];

  const res = http.post(
    `${urls.document}/api/documents/confirm-upload`,
    JSON.stringify({
      uploadId,
      applicationId: appId,
      documentType,
      ocrRequired: Math.random() > 0.5,
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'document/confirm-upload' },
    },
  );

  uploadConfirmDuration.add(res.timings.duration);
  handleError(res, 'Confirm upload');

  check(res, {
    'confirm upload returns 200 or 400': (r) => r.status === 200 || r.status === 400,
  });

  if (res.status === 200) {
    uploadConfirmSuccess.add(1);
  }
}

export function testDocumentUploadFlow(token: string) {
  let appId: string;
  try {
    appId = ensureApplication(token);
  } catch {
    return;
  }
  if (!appId) return;

  const documentType = documentTypes[Math.floor(Math.random() * documentTypes.length)];
  const fileSize = 102400 + Math.floor(Math.random() * 512000);

  const presignedRes = http.post(
    `${urls.document}/api/documents/presigned-url`,
    JSON.stringify({
      applicationId: appId,
      documentType,
      fileName: `flow_${Date.now()}.pdf`,
      contentType: 'application/pdf',
      fileSizeBytes: fileSize,
    }),
    { headers: getAuthHeaders(token) },
  );

  if (presignedRes.status !== 201) return;

  const presignedBody = presignedRes.json() as any;
  const uploadId = presignedBody.uploadId;

  const confirmRes = http.post(
    `${urls.document}/api/documents/confirm-upload`,
    JSON.stringify({
      uploadId,
      applicationId: appId,
      documentType,
      ocrRequired: true,
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'document/upload-flow' },
    },
  );

  check(confirmRes, {
    'confirm after presigned returns 200 or 400': (r) => r.status === 200 || r.status === 400,
    'returns document id': (r) => {
      const b = r.json() as any;
      return b && !!b.id;
    },
  });

  if (confirmRes.status === 200) {
    const body = confirmRes.json() as any;
    if (body.id) {
      createdDocIds.push(body.id);
    }
    uploadConfirmSuccess.add(1);
  }
}

export function testListDocuments(token: string) {
  let appId: string;
  try {
    appId = ensureApplication(token);
  } catch {
    return;
  }
  if (!appId) return;

  const docTypes = [...documentTypes, undefined];
  const docType = docTypes[Math.floor(Math.random() * docTypes.length)];

  const params: Record<string, string> = {};
  if (docType) params['documentType'] = docType;

  const res = http.get(
    `${urls.document}/api/applications/${appId}/documents`,
    {
      params,
      headers: getAuthHeaders(token),
      tags: { name: 'document/list' },
    },
  );

  handleError(res, 'List documents');

  check(res, {
    'list documents returns 200': (r) => r.status === 200,
    'returns documents array': (r) => {
      const b = r.json() as any;
      return b && Array.isArray(b.documents);
    },
  });

  if (res.status === 200) {
    documentListSuccess.add(1);
  }
}

export function testDocumentReview(token: string) {
  if (createdDocIds.length === 0) return;

  const docId = createdDocIds[Math.floor(Math.random() * createdDocIds.length)];
  const statuses = ['APPROVED', 'REJECTED', 'UNDER_REVIEW'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];

  const res = http.post(
    `${urls.document}/api/documents/${docId}/review`,
    JSON.stringify({
      status,
      remarks: `Load test review: ${status}`,
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'document/review' },
    },
  );

  handleError(res, 'Document review');

  check(res, {
    'document review returns 200 or 400': (r) => r.status === 200 || r.status === 400,
  });

  if (res.status === 200) {
    documentReviewSuccess.add(1);
  }
}

export function testDocumentStats(token: string) {
  let appId: string;
  try {
    appId = ensureApplication(token);
  } catch {
    return;
  }

  const params: Record<string, string> = {};
  if (appId) params['applicationId'] = appId;

  const res = http.get(
    `${urls.document}/api/documents/stats`,
    {
      params,
      headers: getAuthHeaders(token),
      tags: { name: 'document/stats' },
    },
  );

  handleError(res, 'Document stats');

  check(res, {
    'document stats returns 200': (r) => r.status === 200,
    'returns totalDocuments': (r) => {
      const b = r.json() as any;
      return b && typeof b.totalDocuments === 'number';
    },
  });

  if (res.status === 200) {
    documentStatsSuccess.add(1);
  }
}

export function testDocumentReviewHistory(token: string) {
  if (createdDocIds.length === 0) return;

  const docId = createdDocIds[Math.floor(Math.random() * createdDocIds.length)];

  const res = http.get(
    `${urls.document}/api/documents/${docId}/reviews`,
    {
      headers: getAuthHeaders(token),
      tags: { name: 'document/review-history' },
    },
  );

  handleError(res, 'Review history');

  check(res, {
    'review history returns 200': (r) => r.status === 200,
    'returns reviews array': (r) => {
      const b = r.json() as any;
      return b && Array.isArray(b);
    },
  });
}

export function testCreateChecklist(token: string) {
  let appId: string;
  try {
    appId = ensureApplication(token);
  } catch {
    return;
  }
  if (!appId) return;

  const loanTypes = ['PERSONAL_LOAN', 'HOME_LOAN', 'LAP', 'VEHICLE_LOAN_FOUR_WHEELER', 'GOLD_LOAN'];
  const loanType = loanTypes[Math.floor(Math.random() * loanTypes.length)];

  const res = http.post(
    `${urls.document}/api/documents/checklist`,
    JSON.stringify({
      applicationId: appId,
      loanType,
      checklistType: 'PDD',
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'document/checklist/create' },
    },
  );

  handleError(res, 'Create checklist');

  check(res, {
    'create checklist returns 201': (r) => r.status === 201,
    'returns checklist items': (r) => {
      const b = r.json() as any;
      return b && Array.isArray(b) && b.length > 0;
    },
  });

  if (res.status === 201) {
    checklistCreateSuccess.add(1);
  }
}
