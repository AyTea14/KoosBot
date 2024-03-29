import type { Player } from "#lib/audio";
import { KoosCommand } from "#lib/extensions";
import { Emoji, KoosColor } from "#utils/constants";
import { sec } from "#utils/functions";
import { EmbedBuilder } from "@discordjs/builders";
import { ApplyOptions } from "@sapphire/decorators";
import { reply } from "@sapphire/plugin-editable-commands";
import { isNullish } from "@sapphire/utilities";

@ApplyOptions<KoosCommand.Options>({
    description: "Move the dashboard to the bottom.",
    aliases: ["dash"],
    preconditions: ["VoiceOnly", "DJ"],
    cooldown: sec(10),
})
export class DashboardCommand extends KoosCommand {
    public override registerApplicationCommands(registery: KoosCommand.Registry) {
        registery.registerChatInputCommand((builder) =>
            builder //
                .setName(this.name)
                .setDescription(this.description)
        );
    }

    public async chatInputRun(interaction: KoosCommand.ChatInputCommandInteraction) {
        const { manager } = this.container;
        const player = manager.players.get(`${interaction.guildId}`);

        if (isNullish(player) || isNullish(player.current))
            return interaction.reply({
                embeds: [new EmbedBuilder().setDescription(`There's nothing playing in this server`).setColor(KoosColor.Warn)],
                ephemeral: true,
            });

        await interaction.deferReply({ ephemeral: true });

        await this.dashboard(player);
        interaction.followUp({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`${Emoji.Yes} Successfully moved the dashboard to the bottom`)
                    .setColor(KoosColor.Default),
            ],
        });
    }

    public async messageRun(message: KoosCommand.Message) {
        const { manager } = this.container;
        const player = manager.players.get(`${message.guildId}`);

        if (isNullish(player) || isNullish(player.current))
            return reply(message, {
                embeds: [new EmbedBuilder().setDescription(`There's nothing playing in this server`).setColor(KoosColor.Warn)],
            });

        await this.dashboard(player).then(async () => await message.react("👍"));
    }

    private async dashboard(player: Player) {
        const dashboard = player.dashboard();

        if (dashboard.deletable) {
            await dashboard.delete();
        }
    }
}
