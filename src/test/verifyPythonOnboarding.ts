import * as fs from 'fs';
import * as path from 'path';
import { analyzeRepository } from '../analyzers/RepositoryAnalyzer';
import { PythonEnvEngine } from '../runners/PythonEnvEngine';
import { ActivityTimeline } from '../services/ActivityTimeline';
import { LogStreamer } from '../services/LogStreamer';

const TEST_DIR = path.join(__dirname, '../../temp-test-repos');

async function cleanDir(dir: string) {
  if (fs.existsSync(dir)) {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

async function createDummyFile(filePath: string, content = '') {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true });
  }
  await fs.promises.writeFile(filePath, content, 'utf-8');
}

async function runTest() {
  console.log('=== STARTING PYTHON ENVIRONMENT TESTING ===');
  await cleanDir(TEST_DIR);
  await fs.promises.mkdir(TEST_DIR, { recursive: true });

  const timeline = new ActivityTimeline();
  const streamer = new LogStreamer();

  // Listen to timeline and streamer for validation
  const logs: string[] = [];
  streamer.on('log', (entry) => {
    logs.push(`[${entry.level.toUpperCase()}] ${entry.message}`);
  });

  const testCases = [
    {
      name: 'Scenario 1: Standalone Python Project',
      files: ['requirements.txt'],
      expectedRoots: ['.'],
    },
    {
      name: 'Scenario 2: Root Frontend + Python Backend',
      files: ['package.json', 'backend/requirements.txt'],
      expectedRoots: ['backend'],
    },
    {
      name: 'Scenario 3: Root Frontend + Python server',
      files: ['package.json', 'server/requirements.txt'],
      expectedRoots: ['server'],
    },
    {
      name: 'Scenario 4: Client-Server Architecture',
      files: ['client/package.json', 'server/requirements.txt'],
      expectedRoots: ['server'],
    },
    {
      name: 'Scenario 5: Frontend-Backend Architecture',
      files: ['frontend/package.json', 'backend/requirements.txt'],
      expectedRoots: ['backend'],
    },
    {
      name: 'Scenario 6: Multiple Python Services',
      files: ['services/auth-service/requirements.txt', 'services/api-service/requirements.txt'],
      expectedRoots: ['services/auth-service', 'services/api-service'],
    },
  ];

  for (const tc of testCases) {
    console.log(`\n--- Running ${tc.name} ---`);
    const caseDir = path.join(TEST_DIR, tc.name.replace(/[^a-zA-Z0-9]/g, '_'));
    await fs.promises.mkdir(caseDir, { recursive: true });

    // Create the scenario structure
    for (const f of tc.files) {
      await createDummyFile(path.join(caseDir, f), f.endsWith('.json') ? '{}' : 'dummy content');
    }

    // Step A: Detect Python root folders
    const analysis = await analyzeRepository(caseDir);
    const detectedRoots = (analysis.pythonProjects || []).map(p => p.relativePath);
    console.log(`Detected Python roots: ${JSON.stringify(detectedRoots)}`);
    
    // Assert detected roots
    const rootsMatch = tc.expectedRoots.every(r => detectedRoots.includes(r)) && detectedRoots.length === tc.expectedRoots.length;
    if (!rootsMatch) {
      throw new Error(`Assertion failed: Expected roots ${JSON.stringify(tc.expectedRoots)}, got ${JSON.stringify(detectedRoots)}`);
    }
    console.log('✓ Root detection assertion passed');

    // Step B: Setup Python environments (creation)
    logs.length = 0;
    timeline.reset();

    const engine = new PythonEnvEngine({
      pythonProjects: analysis.pythonProjects || [],
      timeline,
      streamer
    });

    const results = await engine.run();

    for (const res of results) {
      console.log(`Venv status for ${res.relativePath}: ${res.venvName} - ${res.venvStatus}`);
      if (res.venvStatus !== 'Created') {
        throw new Error(`Assertion failed: Expected venvStatus to be 'Created' for ${res.relativePath}, got ${res.venvStatus}`);
      }
      
      // Verify venv folder was actually created in filesystem
      const venvPath = path.join(res.path, '.venv');
      if (!fs.existsSync(venvPath)) {
        throw new Error(`Assertion failed: Venv directory does not exist at ${venvPath}`);
      }
    }
    console.log('✓ Environment creation assertion passed');

    // Verify logs contains expected messages
    const logCheck = logs.some(l => l.includes('Creating Python virtual environment')) && logs.some(l => l.includes('✓ Creating Python virtual environment'));
    if (!logCheck) {
       console.log('Logs captured:');
       console.log(logs.join('\n'));
       throw new Error('Assertion failed: Expected venv creation log messages not found');
    }
    console.log('✓ Logging assertion passed');

    // Step C: Run setup again (validation and reuse)
    console.log('Re-running setup to test reuse...');
    logs.length = 0;
    timeline.reset();

    // Re-analyze repository (which should now detect the valid virtual environments)
    const analysis2 = await analyzeRepository(caseDir);
    for (const p of analysis2.pythonProjects || []) {
      if (p.venvStatus !== 'Validated') {
        throw new Error(`Assertion failed: Re-analysis expected venvStatus 'Validated', got ${p.venvStatus}`);
      }
    }
    console.log('✓ Re-analysis validation assertion passed');

    const engine2 = new PythonEnvEngine({
      pythonProjects: analysis2.pythonProjects || [],
      timeline,
      streamer
    });
    
    const results2 = await engine2.run();
    for (const res of results2) {
      console.log(`Venv reuse status for ${res.relativePath}: ${res.venvName} - ${res.venvStatus}`);
      if (res.venvStatus !== 'Reused') {
        throw new Error(`Assertion failed: Expected venvStatus to be 'Reused' for ${res.relativePath}, got ${res.venvStatus}`);
      }
    }
    console.log('✓ Environment reuse assertion passed');

    // Verify logs contains validation and reuse messages
    const reuseLogCheck = logs.some(l => l.includes('✓ Existing virtual environment found')) && 
                          logs.some(l => l.includes('✓ Virtual environment validated')) &&
                          logs.some(l => l.includes('✓ Reusing existing virtual environment'));
    if (!reuseLogCheck) {
       console.log('Logs captured:');
       console.log(logs.join('\n'));
       throw new Error('Assertion failed: Expected venv reuse/validation log messages not found');
    }
    console.log('✓ Validation and reuse logging assertion passed');
  }

  // Clean up
  await cleanDir(TEST_DIR);
  console.log('\n=== ALL PYTHON ENVIRONMENT TESTS PASSED SUCCESSFULLY ===');
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
