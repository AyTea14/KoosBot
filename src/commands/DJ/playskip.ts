import { Queue } from "#lib/audio";
import { KoosCommand } from "#lib/extensions";
import { SearchEngine, type PlayCommandOptions } from "#lib/types";
import { KoosColor } from "#utils/constants";
import { canJoinVoiceChannel, createTitle, cutText, sendLoadingMessage } from "#utils/functions";
import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import { send } from "@sapphire/plugin-editable-commands";
import { filterNullishAndEmpty, isNullish, isNullishOrEmpty } from "@sapphire/utilities";
import { oneLine } from "common-tags";
import {
    ChannelType,
    EmbedBuilder,
    GuildMember,
    Message,
    type ApplicationCommandOptionChoiceData,
    type VoiceBasedChannel,
} from "discord.js";
import pluralize from "pluralize";

@ApplyOptions<KoosCommand.Options>({
    description: "Play the tracks right away.",
    aliases: ["ps"],
    preconditions: ["VoiceOnly", "DJ"],
    detailedDescription: {
        usage: [":query"],
    },
})
export class PlaySkipCommand extends KoosCommand {
    private tracks: Map<string, string[]> = new Map<string, string[]>();

    public override registerApplicationCommands(registery: KoosCommand.Registry) {
        registery.registerChatInputCommand((builder) =>
            builder //
                .setName(this.name)
                .setDescription(this.description)
                .addStringOption((option) =>
                    option //
                        .setName("query")
                        .setDescription("Could be a link of the track, or a search term")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        );
    }

    public async chatInputRun(interaction: KoosCommand.ChatInputCommandInteraction) {
        await interaction.deferReply();

        const { manager, db } = this.container;
        const guildId = `${interaction.guildId}`;
        const query = interaction.options.getString("query", true)!;

        const data = await db.guild.findUnique({ where: { id: guildId } });

        const member = interaction.member! as GuildMember;
        const channel = member.voice.channel as VoiceBasedChannel;

        let index = Number(query.split(":").filter(filterNullishAndEmpty)[1]);
        let player = manager.players.get(interaction.guildId!);
        let tracks = this.tracks.get(`${guildId}:${member.id}`) ?? [];
        let selected = query.startsWith("a:") ? tracks[index] : query;
        this.tracks.delete(`${guildId}:${member.id}`);

        const response = await this.playSkip(selected, { message: interaction, player, channel, data });

        await interaction.editReply({
            embeds: [response],
        });
    }

    public async messageRun(message: Message, args: Args) {
        await sendLoadingMessage(message);
        const { manager, db } = this.container;
        const data = await db.guild.findUnique({ where: { id: `${message.guildId}` } });
        const attachment = message.attachments.first();
        const query = attachment ? attachment.proxyURL : await args.rest("string").catch(() => undefined);
        if (!query)
            return await send(message, {
                embeds: [new EmbedBuilder().setDescription("Please provide a URL or search query").setColor(KoosColor.Error)],
            });

        const channel = message.member?.voice.channel as VoiceBasedChannel;
        let player = manager.players.get(message.guildId!);

        const response = await this.playSkip(query, { message, player, channel, data });

        await send(message, { embeds: [response] });
    }

    public async autocompleteRun(interaction: KoosCommand.AutocompleteInteraction) {
        const { manager } = this.container;
        const query = interaction.options.getFocused(true);
        const guildId = `${interaction.guildId}`;
        const memberId = (interaction.member as GuildMember).id;

        if (!query.value) return interaction.respond([]);
        let { tracks, loadType, playlistInfo } = await manager.search(query.value, {
            requester: interaction.member as GuildMember,
            engine: SearchEngine.YoutubeMusic,
        });

        if (loadType === "PLAYLIST_LOADED") {
            let tracks = [query.value];
            this.tracks.set(`${guildId}:${memberId}`, tracks);
            return interaction.respond([{ name: cutText(`${playlistInfo.name}`, 100), value: `a:${tracks.length - 1}` }]);
        } else {
            tracks = tracks.slice(0, 10);

            this.tracks.set(
                `${guildId}:${memberId}`,
                tracks.map((track) => track.uri)
            );
            const options: ApplicationCommandOptionChoiceData[] = tracks.map((track, i) => {
                const title = createTitle(track, false);
                return {
                    name: `${cutText(title, 100)}`,
                    value: `a:${i}`,
                };
            });

            return interaction.respond(options);
        }
    }

    private async playSkip(query: string, { message, player, channel, data }: PlayCommandOptions) {
        const { manager } = this.container;
        const result = await manager.search(query, { requester: message.member as GuildMember }).catch(() => undefined);
        if (!result) return new EmbedBuilder().setDescription(`Something went wrong`).setColor(KoosColor.Error);
        if (isNullishOrEmpty(result.tracks))
            return new EmbedBuilder().setDescription(`I couldn't find anything in the query you gave me`).setColor(KoosColor.Default);

        if (!player) {
            if (!canJoinVoiceChannel(channel))
                return new EmbedBuilder()
                    .setDescription(`I cannot join your voice channel. It seem like I don't have the right permissions.`)
                    .setColor(KoosColor.Error);
            player ??= await manager.createPlayer({
                guildId: message.guildId!,
                textChannel: message.channelId!,
                voiceChannel: channel!.id,
                selfDeafen: true,
                volume: isNullish(data) ? 100 : data.volume,
            });

            if (channel.type === ChannelType.GuildStageVoice) {
                message.guild?.members.me?.voice.setSuppressed(false);
            }
        }

        if (result.loadType === "PLAYLIST_LOADED") {
            const newQueue = new Queue();
            const currentQueue = player.queue.data;
            player.queue.clear();

            for (let track of result.tracks) newQueue.add(track);

            const playlistLength = result.tracks.length;
            const msg = oneLine`
                Queued playlist [${result.playlistInfo.name}](${query}) with
                ${playlistLength} ${pluralize("track", playlistLength)}
            `;

            const firstTrack = newQueue.shift();

            if (!isNullish(player.current)) player.queue.add(player.current);

            for (let track of currentQueue) player.queue.add(track);
            for (let track of newQueue.reverse()) player.queue.unshift(track);
            player.play(firstTrack, { replaceCurrent: true });

            return new EmbedBuilder().setDescription(msg).setColor(KoosColor.Default);
        } else if (["SEARCH_RESULT", "TRACK_LOADED"].includes(result.loadType)) {
            const track = result.tracks[0];
            const title = createTitle(track);

            player.play(track);
            return new EmbedBuilder().setDescription(`Playing ${title} right away`).setColor(KoosColor.Default);
        } else
            return new EmbedBuilder().setDescription(`Something went wrong when trying to play the track`).setColor(KoosColor.Error);
    }
}
