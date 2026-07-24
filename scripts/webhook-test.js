import path from "path";
import dotenv from "dotenv"
dotenv.config({path: path.resolve(process.cwd(), "../.env")})
const webhookUrl = `https://discord.com/api/webhooks/${process.env.DISCORD_WEBHOOK_ID}/${process.env.DISCORD_WEBHOOK_TOKEN}`
console.log(process.env.DISCORD_WEBHOOK_ID + ", " + process.env.DISCORD_WEBHOOK_TOKEN)
const payload = {
    content: 'Here is your update!',
    embeds: [
        {
            title: "App notification",
            description: "This embed was sent successfully from JavaScript!",
            url: "https://www.bruh.com",
            color: 3447003, // Decimal color format (Blue: #3498DB)
            fields: [
            {
                name: "Status",
                value: "Online",
                inline: true
            },
            {
                name: "Environment",
                value: "Production",
                inline: true
            }
            ],
            author: {
                name: "My Bot System",
                icon_url: "https://i.imgur.com/R66g1Pe.jpg"
            },
            footer: {
                text: "Automated Message",
                icon_url: "https://i.imgur.com/fKL21y5.png"
            },
            timestamp: new Date().toISOString()
        }
    ]
};


async function sendNotification() {
    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    }).then(res => {
        if (res.status === 204) console.log("Success!");
        else console.log(res.status + ", " + res.body);
    })
    .catch (err => console.error("Error: " + err));
}

sendNotification();