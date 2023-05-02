import { KoosCommand } from "#lib/extensions";
import { PlayOptions } from "#lib/interfaces";
import { KoosColor } from "#utils/constants";
import { createTitle, cutText } from "#utils/functions";
import { ApplyOptions } from "@sapphire/decorators";
import { canJoinVoiceChannel } from "@sapphire/discord.js-utilities";
import { Args } from "@sapphire/framework";
import { send } from "@sapphire/plugin-editable-commands";
import { filterNullishAndEmpty, isNullish, isNullishOrEmpty } from "@sapphire/utilities";
import { oneLine } from "common-tags";
import { ApplicationCommandOptionChoiceData, EmbedBuilder, GuildMember, Message, VoiceBasedChannel } from "discord.js";
import pluralize from "pluralize";

@ApplyOptions<KoosCommand.Options>({
    description: "Insert the tracks right after the current song playing.",
    aliases: ["pt"],
    preconditions: ["VoiceOnly", "DJ"],
    detailedDescription: {
        usages: [":query"],
    },
})
export class PlayTopCommand extends KoosCommand {
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

        const { kazagumo, db } = this.container;
        const guildId = `${interaction.guildId}`;
        const query = interaction.options.getString("query", true)!;

        const data = await db.guild.findUnique({ where: { id: guildId } });

        const member = interaction.member! as GuildMember;
        const channel = member.voice.channel as VoiceBasedChannel;

        let index = Number(query.split(":").filter(filterNullishAndEmpty)[1]);
        let player = kazagumo.getPlayer(interaction.guildId!);
        let tracks = this.tracks.get(`${guildId}:${member.id}`) ?? [];
        let selected = query.startsWith("a:") ? tracks[index] : query;
        this.tracks.delete(`${guildId}:${member.id}`);

        // await this.playSkip(selected, { message: interaction, player, channel, data });
        await interaction.editReply({
            embeds: [await this.playTop(selected, { message: interaction, player, channel, data })],
        });
    }

    public async messageRun(message: Message, args: Args) {
        const { kazagumo, db } = this.container;
        const data = await db.guild.findUnique({ where: { id: `${message.guildId}` } });
        const attachment = message.attachments.first();
        const query = attachment ? attachment.proxyURL : await args.rest("string").catch(() => undefined);
        if (!query)
            return await send(message, {
                embeds: [new EmbedBuilder().setDescription("Please provide an URL or search query").setColor(KoosColor.Error)],
            });

        const channel = message.member?.voice.channel as VoiceBasedChannel;
        let player = kazagumo.getPlayer(message.guildId!);

        // await this.playSkip(query, { message, player, channel, data });
        await send(message, { embeds: [await this.playTop(query, { message, player, channel, data })] });
    }

    public async autocompleteRun(interaction: KoosCommand.AutocompleteInteraction) {
        const { kazagumo } = this.container;
        const query = interaction.options.getFocused(true);
        const guildId = `${interaction.guildId}`;
        const memberId = (interaction.member as GuildMember).id;

        if (!query.value) return interaction.respond([]);
        let { tracks, type, playlistName } = await kazagumo.search(query.value, {
            requester: interaction.member,
            engine: "youtube_music",
        });

        if (type === "PLAYLIST") {
            let tracks = [query.value];
            this.tracks.set(`${guildId}:${memberId}`, tracks);
            return interaction.respond([{ name: cutText(`${playlistName}`, 100), value: `a:${tracks.length - 1}` }]);
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

    private async playTop(query: string, { message, player, channel, data }: PlayOptions) {
        const { kazagumo } = this.container;
        const result = await kazagumo.search(query, { requester: message.member }).catch(() => undefined);
        if (!result) return new EmbedBuilder().setDescription(`Something went wrong`).setColor(KoosColor.Error);
        if (isNullishOrEmpty(!result.tracks.length))
            return new EmbedBuilder().setDescription(`I couldn't find anything in the query you gave me`).setColor(KoosColor.Default);

        if (!player) {
            if (!canJoinVoiceChannel(channel))
                return new EmbedBuilder()
                    .setDescription(`I cannot join your voice channel. It seem like I don't have the right permissions.`)
                    .setColor(KoosColor.Error);
            player ??= await kazagumo.createPlayer({
                guildId: message.guildId!,
                textId: message.channelId!,
                voiceId: channel!.id,
                deaf: true,
                volume: isNullish(data) ? 100 : data.volume,
            });
        }

        let msg: string = "";
        switch (result.type) {
            case "PLAYLIST":
                for (let track of result.tracks.reverse()) player.queue.unshift(track);
                const playlistLength = result.tracks.length;
                msg = oneLine`
                    Queued playlist [${result.playlistName}](${query}) with
                    ${playlistLength} ${pluralize("track", playlistLength)}
                `;
                break;
            case "SEARCH":
            case "TRACK":
                let [track] = result.tracks;
                let title = createTitle(track);

                player.queue.unshift(track);
                const position = player.queue.findIndex((x) => x.identifier === track.identifier);
                msg = `Queued ${title} at position #${position}`;
                break;
        }

        if (!player.playing && !player.paused) player.play();

        return new EmbedBuilder().setDescription(msg).setColor(KoosColor.Default);
    }
}
