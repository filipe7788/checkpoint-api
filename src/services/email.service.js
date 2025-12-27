const { Resend } = require('resend');

class EmailService {
  constructor() {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured - email sending will be disabled');
      this.resend = null;
      return;
    }

    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@checkpoints.cc';
    this.frontendUrl = process.env.FRONTEND_URL || 'https://checkpoints.cc';
  }

  async sendPasswordResetEmail(toEmail, resetToken) {
    if (!this.resend) {
      console.warn('Email service not configured - skipping password reset email');
      return;
    }

    const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: toEmail,
        subject: 'CheckPoint - Redefinir Senha',
        html: this.getPasswordResetTemplate(resetUrl),
      });

      if (error) {
        console.error('Error sending password reset email:', error);
        throw new Error(`Failed to send email: ${error.message}`);
      }

      console.log('Password reset email sent successfully:', data);
      return data;
    } catch (error) {
      console.error('Error sending email via Resend:', error);
      throw error;
    }
  }

  getPasswordResetTemplate(resetUrl) {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinir Senha - CheckPoint</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">CheckPoint</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1a1a1a; font-size: 24px; font-weight: 600;">Redefinir sua senha</h2>
              <p style="margin: 0 0 24px; color: #666666; font-size: 16px; line-height: 1.6;">
                Você solicitou a redefinição de senha da sua conta CheckPoint. Clique no botão abaixo para criar uma nova senha:
              </p>

              <!-- Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                <tr>
                  <td style="border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                      Redefinir Senha
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                Este link é válido por 1 hora. Se você não solicitou a redefinição de senha, pode ignorar este email.
              </p>

              <p style="margin: 16px 0 0; color: #999999; font-size: 12px; line-height: 1.6;">
                Se o botão não funcionar, copie e cole este link no seu navegador:<br>
                <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9f9f9; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                &copy; ${new Date().getFullYear()} CheckPoint. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }
}

module.exports = new EmailService();
