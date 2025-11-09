
import { randomUUID } from 'crypto';

//Generate a unique ID for a job.

export function generateId() {
  return randomUUID();
}


// Return the current time in ISO format.

export function nowISO() {
  return new Date().toISOString();
}


 // Parse a JSON string or throw an error.
 
export function parseJSONorDie(str) {
  try {
    return JSON.parse(str);
  } catch {
    throw new Error('Invalid JSON argument');
  }
}


 // Sleep helper — for implementing backoff delays.
 
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


 // Exponential backoff: delay = base^attempts seconds
 
export function calculateBackoff(base, attempts) {
  return Math.pow(base, attempts) * 1000; // return ms
}
