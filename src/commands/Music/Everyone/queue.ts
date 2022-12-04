import { KoosCommand } from "#lib/extensions";
import { convertTime, pagination } from "#utils/functions";
import { embedColor } from "#utils/constants";
import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import { reply } from "@sapphire/plugin-editable-commands";
import { Message, MessageEmbed, TextChannel, User } from "discord.js";
import { KazagumoPlayer } from "kazagumo";

@ApplyOptions<KoosCommand.Options>({
    description: "Display the current queue.",
    aliases: ["q"],
    preconditions: ["GuildOnly", "VoiceOnly"],
})
export class UserCommand extends KoosCommand {
    public override registerApplicationCommands(registery: KoosCommand.Registry) {
        registery.registerChatInputCommand(
            (builder) =>
                builder //
                    .setName(this.name)
                    .setDescription(this.description),
            { idHints: ["1047810767858171944", "1048159861004836926"] }
        );
    }

    public async chatInputRun(interaction: KoosCommand.ChatInputInteraction) {
        const { kazagumo } = this.container;
        const player = kazagumo.getPlayer(`${interaction.guildId}`);
        const target = interaction.member!.user as User;

        if (player) await interaction.deferReply();
        if (!player || (player && !player.queue.current)) {
            return interaction.reply({
                embeds: [{ description: "There's nothing playing in this server", color: embedColor.warn }],
                ephemeral: true,
            });
        }

        pagination({ target, channel: interaction, fastSkip: true, embeds: await this.queue(player) });
    }

    public async messageRun(message: Message, _args: Args) {
        const { kazagumo } = this.container;
        const player = kazagumo.getPlayer(`${message.guildId}`);
        const channel = message.channel as TextChannel;
        const target = message.author;

        if (!player || (player && !player.queue.current)) {
            return reply(message, {
                embeds: [{ description: "There's nothing playing in this server", color: embedColor.warn }],
            });
        }

        pagination({ channel, target, fastSkip: true, embeds: await this.queue(player) });
    }

    private async queue(player: KazagumoPlayer) {
        const current = player.queue.current!;
        let timeLeft = current.isStream //
            ? "Live"
            : `${convertTime(Number(current.length) - player.shoukaku.position)} left`;
        let totalDuration =
            player.queue.some((track) => track.isStream) || current.isStream
                ? "Live"
                : `${convertTime(Number(player.queue.durationLength || current.length) - player.shoukaku.position)}`;
        let nowPlaying =
            current.sourceName === "youtube"
                ? `[${current.title}](${current.uri})`
                : `[${current.title} by ${current.author ?? "Unknown artist"}](${current.uri})`;

        if (player.queue.isEmpty) {
            const embed = new MessageEmbed()
                .setDescription(
                    [`__Now playing:__`, `${nowPlaying} [${timeLeft}]`, ``, `__Up next:__`, `No other tracks here`].join("\n")
                )
                .setFooter({ text: `Tracks in queue: ${player.queue.size} | Total Length: ${totalDuration}` })
                .setColor(embedColor.default);

            return [embed];
        }

        let queueList = [];
        for (let i = 0; i < player.queue.length; i += 10) {
            let queue = player.queue.slice(i, i + 10);
            queueList.push(
                queue.map((track, index) => {
                    let title =
                        track.sourceName === "youtube"
                            ? `[${track.title}](${track.uri})`
                            : `[${track.title} by ${track.author ?? "Unknown artist"}](${track.uri})`;
                    return `**${i + ++index}.** ${title} [${track.isStream ? "Live" : convertTime(track.length!)}]`;
                })
            );
        }

        let embeds = [];
        for (let list of queueList) {
            let upNext = list.join("\n");
            embeds.push(
                new MessageEmbed()
                    .setDescription([`__Now playing:__`, `${nowPlaying} [${timeLeft}]`, ``, `__Up next:__`, `${upNext}`].join("\n"))
                    .setFooter({ text: `Tracks in queue: ${player.queue.size} | Total Length: ${totalDuration}` })
                    .setColor(embedColor.default)
            );
        }

        return embeds;
    }
}
