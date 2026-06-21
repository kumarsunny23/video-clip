const API_BASE = 'http://localhost:8000/api';
export const OUTPUTS_BASE = 'http://localhost:8000/outputs';

export const apiClient = {
  async generateVideo(topic) {
    const res = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ topic }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to generate video' }));
      throw new Error(err.detail || 'Failed to generate video');
    }
    return res.json();
  },

  async getJobs() {
    const res = await fetch(`${API_BASE}/jobs`);
    if (!res.ok) throw new Error('Failed to retrieve jobs list');
    return res.json();
  },

  async getJobStatus(jobId) {
    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    if (!res.ok) throw new Error(`Failed to retrieve status for job ${jobId}`);
    return res.json();
  },

  async getVideos() {
    const res = await fetch(`${API_BASE}/videos`);
    if (!res.ok) throw new Error('Failed to retrieve completed videos list');
    return res.json();
  }
};
