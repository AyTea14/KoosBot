import { KoosCommand } from "#lib/extensions";
import { KoosColor } from "#utils/constants";
import { ApplyOptions } from "@sapphire/decorators";
import { reply, send } from "@sapphire/plugin-editable-commands";
import { Message, EmbedBuilder } from "discord.js";
import { KazagumoPlayer } from "kazagumo";

@ApplyOptions<KoosCommand.Options>({
    description: "Stops the player and clear the queue.",
    preconditions: ["VoiceOnly", "DJ"],
})
export class StopCommand extends KoosCommand {
    public override registerApplicationCommands(registery: KoosCommand.Registry) {
        registery.registerChatInputCommand((builder) =>
            builder //
                .setName(this.name)
                .setDescription(this.description)
        );
    }

    public async chatInputRun(interaction: KoosCommand.ChatInputCommandInteraction) {
        const { kazagumo } = this.container;
        const player = kazagumo.getPlayer(`${interaction.guildId}`);

        if (!player || (player && !player.queue.current))
            return interaction.reply({
                embeds: [new EmbedBuilder().setDescription(`There's nothing playing in this server`).setColor(KoosColor.Warn),],
                ephemeral: true,
            });

        await interaction.deferReply();

        interaction.followUp({ embeds: [await this.stop(player)] });
    }

    public async messageRun(message: Message) {
        const { kazagumo } = this.container;
        const player = kazagumo.getPlayer(`${message.guildId}`);

        if (!player) {
            return reply(message, {
                embeds: [new EmbedBuilder().setDescription(`There's nothing playing in this server`).setColor(KoosColor.Warn),],
            });
        }

        send(message, { embeds: [await this.stop(player)] });
    }

    private async stop(player: KazagumoPlayer) {
        player.queue.clear();
        player.shoukaku.stopTrack();

        return new EmbedBuilder().setDescription("Stopped playback and cleared the queue").setColor(KoosColor.Default);
    }
}
