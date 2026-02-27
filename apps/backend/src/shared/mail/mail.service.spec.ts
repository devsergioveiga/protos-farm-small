import { sendMail, _resetTransporter } from './mail.service';

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

import nodemailer from 'nodemailer';

describe('Mail Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetTransporter();
  });

  it('should create transporter with SMTP config from env', async () => {
    await sendMail({
      to: 'user@test.com',
      subject: 'Test Subject',
      text: 'Test body',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'localhost',
        port: 1025,
      }),
    );
  });

  it('should send email with correct fields', async () => {
    await sendMail({
      to: 'user@test.com',
      subject: 'Test Subject',
      text: 'Test body',
      html: '<p>Test body</p>',
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@protosfarm.dev',
        to: 'user@test.com',
        subject: 'Test Subject',
        text: 'Test body',
        html: '<p>Test body</p>',
      }),
    );
  });

  it('should send email without html when not provided', async () => {
    await sendMail({
      to: 'user@test.com',
      subject: 'Test Subject',
      text: 'Test body',
    });

    const callArgs = mockSendMail.mock.calls[0][0];
    expect(callArgs.html).toBeUndefined();
  });

  it('should reuse transporter on subsequent calls', async () => {
    await sendMail({ to: 'a@test.com', subject: 'S1', text: 'T1' });
    await sendMail({ to: 'b@test.com', subject: 'S2', text: 'T2' });

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  it('should throw when sendMail fails', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused'));

    await expect(sendMail({ to: 'user@test.com', subject: 'Test', text: 'Body' })).rejects.toThrow(
      'SMTP connection refused',
    );
  });
});
