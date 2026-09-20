import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EmailSignup } from './EmailSignup';

describe('EmailSignup', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('submits via GET to the webhook with email query param', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <EmailSignup
        webhookUrl="https://n8n.workgallantly.com/webhook/subscribe"
      />,
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /subscribe/i }));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(
      'https://n8n.workgallantly.com/webhook/subscribe?email=reader%40example.com',
    );
    expect(init?.method).toBe('GET');
  });
});
