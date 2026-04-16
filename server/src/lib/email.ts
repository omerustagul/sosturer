import nodemailer from 'nodemailer';
import prisma from './prisma';

export async function sendResetCode(email: string, code: string) {
  try {
    // Find user to get their company settings
    const userWithSettings = await prisma.user.findUnique({
      where: { email },
      include: {
        company: {
          include: {
            appSettings: true
          }
        }
      }
    });

    const companySettings = userWithSettings?.company?.appSettings;
    const systemConfig = await prisma.system_config.findFirst();
    
    // Priority: Company Settings > System Config > Env
    const host = companySettings?.smtpHost || systemConfig?.smtp_host || process.env.SMTP_HOST;
    const port = companySettings?.smtpPort || systemConfig?.smtp_port || Number(process.env.SMTP_PORT) || 587;
    const user = companySettings?.smtpUser || systemConfig?.smtp_user || process.env.SMTP_USER;
    const pass = companySettings?.smtpPass || systemConfig?.smtp_pass || process.env.SMTP_PASS;
    const from = companySettings?.smtpFrom || systemConfig?.smtp_from || process.env.SMTP_FROM || 'Sosturer <noreply@sosturer.com>';

    if (!host || !user || !pass) {
      console.warn('SMTP settings are missing. Email not sent, code:', code);
      return false;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Şifre Sıfırlama Doğrulama Kodu',
      text: `Şifrenizi sıfırlamak için doğrulama kodunuz: ${code}. Bu kod 2 dakika geçerlidir.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #4f46e5;">Şifre Sıfırlama</h2>
          <p>Şifrenizi sıfırlamak için aşağıda bulunan doğrulama kodunu kullanın:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>Bu kod <strong>120 saniye (2 dakika)</strong> geçerlidir.</p>
          <p>Eğer bu isteği siz yapmadıysanız lütfen bu e-postayı dikkate almayın.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
}
