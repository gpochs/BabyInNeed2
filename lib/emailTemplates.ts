export const emailTemplates = {
  donorConfirmation: (itemName: string) => ({
    subject: "Reservierung bestätigt – Baby in Need",
    text: `Danke fürs Schenken! Du hast "${itemName}" reserviert.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reservierung bestätigt</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Reservierung bestätigt!</h1>
          </div>
          
          <div style="padding: 30px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Vielen Dank, dass du dich entschieden hast zu schenken!</p>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; border-left: 4px solid #667eea; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #2c5aa0; font-size: 20px;">Dein reserviertes Geschenk:</h3>
              <p style="font-size: 22px; font-weight: bold; color: #2c5aa0; margin: 15px 0;">${itemName}</p>
            </div>
            
            <div style="background: #e8f4fd; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h4 style="margin-top: 0; color: #0c5460;">📧 Kontakt</h4>
              <p style="margin: 10px 0;">Falls du Fragen hast oder Änderungen benötigst, wende dich gerne an die werdenden Eltern.</p>
            </div>
            
            <p style="font-size: 16px; margin-top: 25px;">Vielen Dank für deine Großzügigkeit! 🙏</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              Baby in Need - Geschenke für werdende Eltern<br>
              Diese E-Mail wurde automatisch generiert
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  parentNotification: (itemName: string) => ({
    subject: "Neues Geschenk reserviert – Baby in Need",
    text: `Soeben wurde "${itemName}" reserviert.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Neues Geschenk reserviert</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎁 Neues Geschenk reserviert!</h1>
          </div>
          
          <div style="padding: 30px;">
            <p style="font-size: 16px; margin-bottom: 20px;">Soeben wurde ein neues Geschenk reserviert:</p>
            
            <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; border-left: 4px solid #28a745; margin: 25px 0;">
              <h3 style="margin-top: 0; color: #155724; font-size: 20px;">Reserviertes Geschenk:</h3>
              <p style="font-size: 22px; font-weight: bold; color: #155724; margin: 15px 0;">${itemName}</p>
            </div>
            
            <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h4 style="margin-top: 0; color: #0f5132;">📅 Reserviert am:</h4>
              <p style="margin: 10px 0; font-weight: bold;">${new Date().toLocaleString('de-CH')}</p>
            </div>
            
            <p style="font-size: 16px; margin-top: 25px;">Das ist wunderbar! 🎉</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              Baby in Need - Geschenke für werdende Eltern<br>
              Diese E-Mail wurde automatisch generiert
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

