import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',use:{baseURL:'http://127.0.0.1:4181',headless:true,channel:'chrome'},webServer:{command:'node node_modules/vite/bin/vite.js preview --port 4181 --host 127.0.0.1 --configLoader runner',url:'http://127.0.0.1:4181',reuseExistingServer:false}});




