import { KoosCommand } from "#lib/extensions";
import { embedColor } from "#utils/constants";
import { databasePing } from "#utils/functions";
import { ApplyOptions } from "@sapphire/decorators";
import { isMessageInstance } from "@sapphire/discord.js-utilities";
import { send } from "@sapphire/plugin-editable-commands";
import type { Message } from "discord.js";

@ApplyOptions<KoosCommand.Options>({
    description: "Get the bot's latency.",
})
export class UserCommand extends KoosCommand {
    public override registerApplicationCommands(registery: KoosCommand.Registry) {
        registery.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName(this.name)
                    .setDescription(this.description),
            { idHints: ["1050092664218984509", "1050094589731684433"] }
        );
    }

    public async chatInputRun(interaction: KoosCommand.ChatInputInteraction) {
        await interaction.deferReply();
        const msg = (await interaction.followUp({ embeds: [{ description: "Ping?", color: embedColor.default }] })) as Message;

        if (isMessageInstance(msg)) {
            const diff = msg.createdTimestamp - interaction.createdTimestamp;
            const ping = Math.round(this.container.client.ws.ping);
            const database = Math.round(await databasePing());
            const content = `Pong 🏓! (Round trip took: ${diff}ms. Heartbeat: ${ping}ms. Database: ${database}ms.)`;

            interaction.editReply({ embeds: [{ description: content, color: embedColor.default }] });
        }
    }

    public async messageRun(message: Message) {
        const msg = await send(message, { embeds: [{ description: "Ping?", color: embedColor.default }] });

        const diff = msg.createdTimestamp - message.createdTimestamp;
        const ping = Math.round(this.container.client.ws.ping);
        const database = Math.round(await databasePing());
        const content = `Pong 🏓! (Round trip took: ${diff}ms. Heartbeat: ${ping}ms. Database: ${database}ms.)`;

        return send(message, { embeds: [{ description: content, color: embedColor.default }] });
    }
}