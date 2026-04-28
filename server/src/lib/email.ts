import nodemailer from 'nodemailer';
import prisma from './prisma';
import { logger } from '../utils/logger';

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
      logger.warn(`SMTP settings are missing for ${email}. Email not sent.`);
      return false;
    }

    logger.info(`Sending reset code to ${email} using ${host}:${port}`);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      }
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
    logger.error('Email sending failed:', error);
    return false;
  }
}

export async function sendTwoFactorCode(email: string, code: string) {
  try {
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

    const host = companySettings?.smtpHost || systemConfig?.smtp_host || process.env.SMTP_HOST;
    const port = companySettings?.smtpPort || systemConfig?.smtp_port || Number(process.env.SMTP_PORT) || 587;
    const user = companySettings?.smtpUser || systemConfig?.smtp_user || process.env.SMTP_USER;
    const pass = companySettings?.smtpPass || systemConfig?.smtp_pass || process.env.SMTP_PASS;
    const from = companySettings?.smtpFrom || systemConfig?.smtp_from || process.env.SMTP_FROM || 'Sosturer <noreply@sosturer.com>';

    if (!host || !user || !pass) {
      logger.warn(`SMTP settings are missing for ${email}. 2FA email not sent.`);
      return false;
    }

    logger.info(`Sending 2FA code to ${email} using ${host}:${port} (User: ${user})`);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Sosturer Giriş Doğrulama Kodu',
      text: `Sosturer giriş doğrulama kodunuz: ${code}. Bu kod 5 dakika geçerlidir.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">Sosturer Giriş Doğrulama</h2>
          <p>Hesabınıza giriş yapmak için aşağıdaki doğrulama kodunu kullanın:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; text-align: center; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p>Bu kod <strong>5 dakika</strong> geçerlidir.</p>
          <p>Bu giriş denemesini siz yapmadıysanız lütfen yöneticinizle iletişime geçin.</p>
        </div>
      `,
    });

    return true;
  } catch (error) {
    logger.error('2FA email sending failed:', error);
    return false;
  }
}
