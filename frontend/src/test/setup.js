import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Reset DOM state after each test case
afterEach(() => {
  cleanup();
});
