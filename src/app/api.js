import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { getConfig } from '@edx/frontend-platform';

export const getPrograms = async () => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getConfig().STUDIO_BASE_URL}/fbr/api/programs/`);
  const list = Array.isArray(data) ? data : data.results ?? [];
  return list.map((p) => ({
    id: p.program_key,
    name: p.name,
    programType: p.program_type,
    org: p.organization,
    batch: p.batch,
    status: p.status,
    startDate: p.start_date,
    endDate: p.end_date,
    description: p.description,
    cardImage: p.card_image || null,
    enrolledAt: p.learner_enrolled_at || null,
    courseCount: p.course_count ?? 0,
  }));
};

export const getProgramCourses = async (programKey) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getConfig().STUDIO_BASE_URL}/fbr/api/programs/${programKey}/courses/`);
  return Array.isArray(data) ? data : (data.results ?? []);
};

export const getProgram = async (programKey) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getConfig().STUDIO_BASE_URL}/fbr/api/programs/${programKey}/`);
  return data;
};

export const updateProgram = async (programKey, payload) => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.patch(`${getConfig().STUDIO_BASE_URL}/fbr/api/programs/${programKey}/`, payload);
  return data;
};

export const getMyCertificate = async (programKey) => {
  // Served by the LMS (the fbr program_certificates app is mounted on both CMS
  // and LMS under the same /fbr/api/cms/certificates/ path). Keyed to the
  // requesting learner, so it returns only their own active certificate.
  const client = getAuthenticatedHttpClient();
  const url = `${getConfig().LMS_BASE_URL}/fbr/api/cms/certificates/my/${programKey}/certificate/`;
  const { data } = await client.get(url);
  return {
    html: data.html,
    certificateNumber: data.certificate_number,
    issuedAt: data.issued_at,
    status: data.status,
    programName: data.program_name,
    traineeName: data.trainee_name,
  };
};

export const getLearnerCourseMap = async () => {
  const client = getAuthenticatedHttpClient();
  const { data } = await client.get(`${getConfig().LMS_BASE_URL}/api/learner_home/init`);
  const map = {};
  (data.courses || []).forEach((entry) => {
    if (entry.courseRun?.courseId) {
      map[entry.courseRun.courseId] = entry;
    }
  });
  return map;
};
