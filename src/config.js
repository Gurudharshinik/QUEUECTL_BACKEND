// src/config.js
import { getConfig as dbGetConfig, setConfig as dbSetConfig } from './db.js';


 // Get a configuration value (string)
 
export function getConfig(key) {
  return dbGetConfig(key);
}


 // Set a configuration value
 
export function setConfig(key, value) {
  dbSetConfig(key, String(value));
}


 // Get a configuration value as integer
 
export function getConfigInt(key) {
  const value = dbGetConfig(key);
  return value ? parseInt(value, 10) : null;
}


 // Get all configuration values as an object
 
export function getAllConfig() {
  const config = {};
  ['max_retries', 'backoff_base'].forEach(k => {
    config[k] = getConfig(k);
  });
  return config;
}
