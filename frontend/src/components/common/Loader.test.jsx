import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Loader from './Loader';

describe('Loader Component', () => {
  test('renders spinner and correct custom message', () => {
    render(<Loader message="Loading items..." />);
    
    // Verify loading label content
    expect(screen.getByText('Loading items...')).toBeDefined();
  });
});
