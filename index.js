require("dotenv").config();

//const axios = require("axios");
const { Client, GatewayIntentBits } = require("discord.js");

//Open client with intent permissions, we are trying to have the ability to read the audit log. (Maybe even moderate based off it)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.AutoModerationConfiguration,
    GatewayIntentBits.AutoModerationExecution,
  ],
});

client.on("ready", () => {
  console.log("Bot Ready");
});

//Format of <access_command> <@user>
const access_command = "migis, check ";

client.on("messageCreate", async (message) => {
  //Simple ping response to allow easy testing of bot
  if (message.content === "ping") {
    message.reply({
      content: "pong",
    });

    //Check if message contains a request to check audit log, formatted like | get audit log <@user> |
  } else if (message.content.includes(access_command)) {
    //Split based off of the audit log message to grab the name after
    let username = message.content.split(access_command);

    //Grab name if it exists
    if (username.length > 1) {
      username = username[1];
    } else {
      //No name given
      message.reply({
        content: "Please give a name",
      });
      return;
    }

    //Fetch audit log entries of the user, (MAX is 100 per call)
    let auditLog = await message.guild.fetchAuditLogs({
      user: username.substring(2, username.length - 1),
      limit: 100,
    });
    let entries = await auditLog.entries;

    //Create tracking variables
    let beforeID = null;
    let infractions = 0;
    let mutes = 0;
    let moves = 0;
    let disconnect = 0;

    //Sort given audit log entries by date (used to give the next call of fetchAuditLogs() to get the logs chronologically before the date)
    entries = entries.sort((a, b) => b.createdTimestamp < a.createdTimestamp);
    console.log("found: " + entries.size);

    //Loop while the amount of audit log entries recieved by fetchAuditLogs() is > 1
    while (entries.size > 1) {
      entries.forEach((entry) => {
        //Ensure that the username is the one actually executing the command present
        if ("<@" + entry.executor.id + ">" === username) {
          //Sometimes, if a command is executed twice in quick succession, only one log will get written with a count of 2, check if a count variable exists, and if it does increment by count instead of 1
          let num = 1;
          if (entry.extra != null && entry.extra.count !== undefined) {
            num = parseInt(entry.extra.count);
          }

          //Add to general infraction count, the number of times the user has been seen in the audit log
          infractions += num;

          //action 24 is a Mute of another user by the infractor
          if (entry.action == 24) {
            mutes += num;
          }

          //action 26 is the movement of a user to another channel by the infractor
          if (entry.action == 26) {
            moves += num;
          }

          //action 27 is the disconnect of a user by the infractor
          if (entry.action == 27) {
            disconnect += num;
          }
        }

        //Keep track of last seen entry ID, yes its lazy but its easy
        beforeID = entry.id;
      });

      //Grab more audit logs only after the last ID we just saw (which is the oldest chronologically so far)
      auditLog = await message.guild.fetchAuditLogs({
        before: beforeID,
        user: username.substring(2, username.length - 1),
        limit: 100,
      });
      entries = await auditLog.entries;
      console.log("found: " + entries.size);

      //Sort newly found entries in chronological order
      entries = entries.sort((a, b) => b.createdTimestamp < a.createdTimestamp);
    }

    console.log("done parsing " + username);

    //Reply with a message in chat with found data.
    message.reply({
      content:
        username +
        " has " +
        mutes +
        " mutes, " +
        moves +
        " moves, " +
        disconnect +
        " disconnects, and a total of " +
        infractions +
        " infractions in the past 30 days.",
    });
    return;
  }
});

//Login the Discord bot using the bot ID found in the .env file
client.login(process.env.DISCORD_BOT_ID);
