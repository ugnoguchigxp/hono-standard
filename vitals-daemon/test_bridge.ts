import { vitalsService } from '../api/services/vitals/vitals.service';

async function test() {
  console.log('Testing Vitals Bridge...');
  
  const mockData = {
    red: Array.from({ length: 100 }, () => Math.random()),
    green: Array.from({ length: 100 }, () => Math.random()),
    blue: Array.from({ length: 100 }, () => Math.random()),
  };

  try {
    const startTime = performance.now();
    const result = await vitalsService.analyzeVitals(mockData);
    const endTime = performance.now();

    console.log('Analysis Result:', result);
    console.log(`Roundtrip time: ${(endTime - startTime).toFixed(2)}ms`);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();
