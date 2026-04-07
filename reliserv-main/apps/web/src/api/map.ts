import { api } from './client'

export type MapWorker = {
  workerId: string
  name: string
  lat: number
  lng: number
  serviceStatus: 'ONLINE' | 'BUSY' | 'OFFLINE'
  reliabilityScore: number
  emergencyOptIn: boolean
  distanceMiles: number | null
  etaMinutes: number | null
  standardEligible: boolean
  emergencyEligible: boolean
}

export type MapWorkersResponse = {
  center: {
    lat: number
    lng: number
    mode: 'normal' | 'emergency'
  }
  workers: MapWorker[]
}

export type JobMapCandidatesResponse = {
  job: {
    id: string
    title: string
    urgency: 'NORMAL' | 'EMERGENCY'
    status: string
    lat: number
    lng: number
  }
  workers: MapWorker[]
}

export async function getMapWorkers(
  lat: number,
  lng: number,
  mode: 'normal' | 'emergency',
) {
  return api<MapWorkersResponse>(
    `/v2/map/workers?lat=${lat}&lng=${lng}&mode=${mode}`,
    {
      method: 'GET',
      auth: true,
    },
  )
}

export async function getJobMapCandidates(jobId: string) {
  return api<JobMapCandidatesResponse>(`/v2/map/jobs/${jobId}/map-candidates`, {
    method: 'GET',
    auth: true,
  })
}
