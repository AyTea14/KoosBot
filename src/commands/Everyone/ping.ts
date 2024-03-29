import { KoosCommand } from "#lib/extensions";
import { KoosColor } from "#utils/constants";
import { databasePing } from "#utils/functions";
import { ApplyOptions } from "@sapphire/decorators";
import { isMessageInstance } from "@sapphire/discord.js-utilities";
import { send } from "@sapphire/plugin-editable-commands";
import { type Message, EmbedBuilder } from "discord.js";

@ApplyOptions<KoosCommand.Options>({
    description: "Get the bot's latency.",
})
export class PingCommand extends KoosCommand {
    public override registerApplicationCommands(registery: KoosCommand.Registry) {
        registery.registerChatInputCommand((builder) =>
            builder //
                .setName(this.name)
                .setDescription(this.description)
        );
    }

    public async chatInputRun(interaction: KoosCommand.ChatInputCommandInteraction) {
        await interaction.deferReply();
        const [msg, database] = await Promise.all([
            (await interaction.followUp({
                embeds: [new EmbedBuilder().setDescription("Ping?").setColor(KoosColor.Default)],
            })) as Message,
            databasePing(),
        ]);

        if (isMessageInstance(msg)) {
            const diff = msg.createdTimestamp - interaction.createdTimestamp;
            const ping = Math.round(this.container.client.ws.ping);
            const content = `Pong 🏓! (Round trip took: ${diff}ms. Heartbeat: ${ping}ms. Database: ${Math.round(database)}ms.)`;

            interaction.editReply({
                embeds: [new EmbedBuilder().setDescription(content).setColor(KoosColor.Default)],
            });
        }
    }

    public async messageRun(message: Message) {
        const [msg, database] = await Promise.all([
            send(message, { embeds: [new EmbedBuilder().setDescription("Ping?").setColor(KoosColor.Default)] }),
            databasePing(),
        ]);

        const diff = msg.createdTimestamp - message.createdTimestamp;
        const ping = Math.round(this.container.client.ws.ping);
        const content = `Pong 🏓! (Round trip took: ${diff}ms. Heartbeat: ${ping}ms. Database: ${Math.round(database)}ms.)`;

        return send(message, { embeds: [new EmbedBuilder().setDescription(content).setColor(KoosColor.Default)] });
    }
}
