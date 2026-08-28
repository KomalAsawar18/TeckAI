import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AiAssistant from './AiAssistant';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    sendAiChat: vi.fn(),
    getAiConversations: vi.fn(),
    getAiConversationById: vi.fn()
  }
}));

describe('AiAssistant Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (initialEntries = ['/ai-assistant']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <AiAssistant />
      </MemoryRouter>
    );
  };

  it('renders initial greeting exactly once', () => {
    renderWithRouter();
    const greetings = screen.getAllByText(/Tell me what you need and I'll help you find the best match/i);
    expect(greetings).toHaveLength(1);
  });

  it('renders one submitted user message and one AI response once', async () => {
    api.sendAiChat.mockResolvedValueOnce({
      success: true,
      data: {
        response: 'Here is a great laptop for you.',
        type: 'catalog_grounded',
        products: []
      }
    });

    renderWithRouter();

    const input = screen.getByPlaceholderText(/Ask about products/i);
    const sendButton = screen.getByRole('button', { name: '' }); // The button with Send icon

    fireEvent.change(input, { target: { value: 'I need a laptop' } });
    fireEvent.click(sendButton);

    // Wait for the response to be rendered
    await waitFor(() => {
      expect(screen.getByText('Here is a great laptop for you.')).toBeDefined();
    });

    // Check user message is rendered once
    const userMessages = screen.getAllByText('I need a laptop');
    expect(userMessages).toHaveLength(1);

    // Check AI message is rendered once
    const aiMessages = screen.getAllByText('Here is a great laptop for you.');
    expect(aiMessages).toHaveLength(1);
  });

  it('uses separate layout elements for assistant icon and content', () => {
    renderWithRouter();
    
    // The message bubble should have a flex layout
    const bubbles = screen.getAllByText(/Tell me what you need and I'll help you find the best match/i);
    const bubbleTextContainer = bubbles[0].closest('.message-text');
    expect(bubbleTextContainer).toBeDefined();

    const messageBubble = bubbleTextContainer.closest('.message-bubble');
    expect(messageBubble.className).toContain('flex');
    expect(messageBubble.className).toContain('gap-3');

    // Inside the bubble, there should be an SVG (Sparkles) outside the message-text
    const svgIcon = messageBubble.querySelector('svg');
    expect(svgIcon).toBeDefined();
    expect(bubbleTextContainer.contains(svgIcon)).toBe(false);
  });

  it('renders a valid conversation restore', async () => {
    api.getAiConversations.mockResolvedValueOnce({ success: true, data: [] });
    api.getAiConversationById.mockResolvedValueOnce({
      success: true,
      data: {
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi there', products: [] }
        ]
      }
    });

    renderWithRouter(['/ai-assistant?c=123']);
    
    await waitFor(() => {
      expect(screen.getByText('hi there')).toBeDefined();
    });
  });

  it('handles invalid/404 conversation without crashing', async () => {
    api.getAiConversations.mockResolvedValueOnce({ success: true, data: [] });
    api.getAiConversationById.mockRejectedValueOnce(new Error('Conversation not found'));

    renderWithRouter(['/ai-assistant?c=999']);
    
    await waitFor(() => {
      expect(screen.getByText(/Conversation unavailable/i)).toBeDefined();
    });
  });

  it('handles empty messages array without crashing', async () => {
    api.getAiConversations.mockResolvedValueOnce({ success: true, data: [] });
    api.getAiConversationById.mockResolvedValueOnce({
      success: true,
      data: {
        messages: []
      }
    });

    renderWithRouter(['/ai-assistant?c=123']);
    
    await waitFor(() => {
      expect(screen.getByText(/Conversation unavailable/i)).toBeDefined();
    });
  });

  it('handles malformed products array without crashing', async () => {
    api.getAiConversations.mockResolvedValueOnce({ success: true, data: [] });
    api.getAiConversationById.mockResolvedValueOnce({
      success: true,
      data: {
        messages: [
          { role: 'assistant', content: 'hello', products: 'not-an-array' }
        ]
      }
    });

    renderWithRouter(['/ai-assistant?c=123']);
    
    await waitFor(() => {
      expect(screen.getByText('hello')).toBeDefined();
    });
  });
});
