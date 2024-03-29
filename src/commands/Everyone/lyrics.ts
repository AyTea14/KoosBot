import { KoosCommand } from "#lib/extensions";
import { Paginator } from "#lib/structures";
import { ButtonId, KoosColor, SelectMenuId, UserAgent } from "#utils/constants";
import { chunk, cutText, decodeEntities, sendLoadingMessage } from "#utils/functions";
import { request } from "@aytea/request";
import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import { send } from "@sapphire/plugin-editable-commands";
import { isNullish, isNullishOrEmpty } from "@sapphire/utilities";
import * as cheerio from "cheerio";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    GuildMember,
    Message,
    StringSelectMenuBuilder,
    type ApplicationCommandOptionChoiceData,
    type SelectMenuComponentOptionData,
} from "discord.js";
import ms from "ms";
import pluralize from "pluralize";

@ApplyOptions<KoosCommand.Options>({
    description: "Get the lyrics of a song.",
    aliases: ["ly"],
    detailedDescription: {
        usage: [":query"],
    },
})
export class LyricsCommand extends KoosCommand {
    public override registerApplicationCommands(registery: KoosCommand.Registry) {
        registery.registerChatInputCommand((builder) =>
            builder //
                .setName(this.name)
                .setDescription(this.description)
                .addStringOption((option) =>
                    option //
                        .setName("query")
                        .setDescription("The song name to search")
                        .setAutocomplete(true)
                        .setRequired(true)
                )
        );
    }

    public async chatInputRun(interaction: KoosCommand.ChatInputCommandInteraction) {
        const { genius } = this.container;

        let query = interaction.options.getString("query", true);
        if (isNullish(query))
            return interaction.reply({
                embeds: [new EmbedBuilder().setDescription("Please provide a song title").setColor(KoosColor.Error)],
                ephemeral: true,
            });
        await interaction.deferReply();

        const song = await genius.songs.get(Number(query)).catch(() => undefined);
        if (!song)
            return interaction.followUp({
                embeds: [new EmbedBuilder().setDescription("No result was found").setColor(KoosColor.Error)],
            });

        const lyrics = await this.getLyrics(song.url).catch(() => undefined);
        if (!lyrics)
            return interaction.followUp({
                embeds: [new EmbedBuilder().setDescription("Something went wrong!").setColor(KoosColor.Error)],
            });

        const lyric = chunk(lyrics.split("\n"), 25);

        const embeds = lyric.reduce((prev: EmbedBuilder[], curr) => {
            prev.push(
                new EmbedBuilder()
                    .setDescription(`${decodeEntities(curr.map((x) => x.replace(/^\[[^\]]+\]$/g, "**$&**")).join("\n"))}`)
                    .setTitle(`${cutText(song.fullTitle, 128)}`)
                    .setThumbnail(song.thumbnail)
                    .setURL(song.url)
                    .setColor(KoosColor.Default)
            );
            return prev;
        }, []);

        const pagination = new Paginator({ member: interaction.member as GuildMember, message: interaction });
        await pagination.addPages(embeds).run();
    }
    public async messageRun(message: Message, args: Args) {
        await sendLoadingMessage(message);
        const { manager } = this.container;
        const player = manager.players.get(message.guildId!)!;
        const query = await args.rest("string").catch(() => {
            if (!player || !player.current) {
                return undefined;
            }
            return `${player.current.title}`;
        });

        const { embed, selectMenu, cancelButton } = await this.lyrics(query);
        const pagination = new Paginator({ message, member: message.member! });

        const msg = await send(message, {
            embeds: [embed],
            components:
                selectMenu && cancelButton
                    ? [
                          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
                          new ActionRowBuilder<ButtonBuilder>().setComponents(cancelButton),
                      ]
                    : undefined,
        });

        const collector = msg.createMessageComponentCollector({
            filter: (i) => {
                const embed = new EmbedBuilder()
                    .setDescription(`This select menu can only be use by ${message.author}`)
                    .setColor(KoosColor.Error);
                if (i.user.id !== message.author.id) i.reply({ embeds: [embed], ephemeral: true });
                return i.user.id === message.author.id && i.message.id === msg.id;
            },
            time: ms("1m"),
        });

        collector.on("collect", async (interaction) => {
            if (interaction.isButton() && interaction.customId === ButtonId.Cancel) {
                await interaction.deferUpdate();

                const embed = new EmbedBuilder().setDescription(`Cancelled the search`).setColor(KoosColor.Default);
                await send(message, { embeds: [embed], components: [] });
                return collector.stop("cancelled");
            }

            if (!interaction.isStringSelectMenu()) return;
            await interaction.deferUpdate();
            const id = interaction.customId;
            if (id !== SelectMenuId.Lyrics) return;
            const input = Number(interaction.values[0]);

            await send(message, {
                embeds: [new EmbedBuilder().setDescription("Fetching lyrics...").setColor(KoosColor.Default)],
            });
            const song = await this.container.genius.songs.get(input).catch(() => undefined);
            const lyrics = await this.getLyrics(song?.url).catch(() => undefined);
            if (!song) {
                send(message, {
                    embeds: [new EmbedBuilder().setDescription("Something went wrong!").setColor(KoosColor.Error)],
                });
                return;
            }
            if (!lyrics) {
                send(message, {
                    embeds: [new EmbedBuilder().setDescription("No result was found").setColor(KoosColor.Error)],
                });
                return;
            }

            const lyric = chunk(lyrics.split("\n"), 25);

            const embeds = lyric.reduce((prev: EmbedBuilder[], curr) => {
                prev.push(
                    new EmbedBuilder()
                        .setDescription(`${decodeEntities(curr.map((x) => x.replace(/^\[[^\]]+\]$/g, "**$&**")).join("\n"))}`)
                        .setTitle(`${cutText(song.title, 128)}`)
                        .setThumbnail(song.thumbnail)
                        .setURL(song.url)
                        .setColor(KoosColor.Default)
                );
                return prev;
            }, []);

            await pagination.addPages(embeds).run();
            collector.stop("selected");
            return;
        });
        collector.on("end", async (_, reason) => {
            if (reason === "time") {
                let actionRow = new ActionRowBuilder<StringSelectMenuBuilder>();
                let timedOutRow = selectMenu
                    ? [actionRow.setComponents(selectMenu.setPlaceholder("Timed out").setDisabled(true))]
                    : undefined;
                await send(message, { embeds: [embed], components: timedOutRow });
                return;
            }
        });
    }

    public async autocompleteRun(interaction: KoosCommand.AutocompleteInteraction) {
        const { genius } = this.container;

        const query = interaction.options.getFocused(true);

        if (isNullishOrEmpty(query.value)) return interaction.respond([]);
        let songs = await genius.songs.search(query.value);
        songs = songs.slice(0, 10);

        const options: ApplicationCommandOptionChoiceData[] = songs.map((song) => ({
            name: `${cutText(song.fullTitle, 100)}`,
            value: `${song.id}`,
        }));
        return interaction.respond(options);
    }

    private async getLyrics(url?: string) {
        if (!url) throw new Error(`Something went wrong!`);
        try {
            const body = await request(url).agent(UserAgent).options({ throwOnError: true }).text();

            const $ = cheerio.load(body);

            const lyrics = $("div[data-lyrics-container=true]")
                .toArray()
                .map((x) => {
                    let ele = $(x);
                    ele.find("div[data-exclude-from-selection=true]").replaceWith("\n");
                    ele.find("br").replaceWith("\n");
                    return ele.text();
                })
                .join("\n")
                .trim();

            return lyrics;
        } catch (error) {
            throw new Error("No result was found");
        }
    }

    private async lyrics(query?: string) {
        if (!query) return { embed: new EmbedBuilder().setDescription("Please provide a song title.").setColor(KoosColor.Error) };
        let result = await this.container.genius.songs.search(query);

        result = result.slice(0, 10);

        if (isNullishOrEmpty(result)) return { embed: new EmbedBuilder().setDescription("No result").setColor(KoosColor.Error) };

        const options: SelectMenuComponentOptionData[] = result.map((song) => ({
            label: cutText(`${song.title}`, 100),
            description: cutText(`by ${song.artist.name}`, 100),
            value: `${song.id}`,
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(SelectMenuId.Lyrics)
            .setPlaceholder("Make a selection")
            .addOptions(options);
        const cancelButton = new ButtonBuilder().setCustomId(ButtonId.Cancel).setLabel("Cancel").setStyle(ButtonStyle.Danger);

        return {
            embed: new EmbedBuilder()
                .setDescription(`There are ${result.length} ${pluralize("result", result.length)}`)
                .setColor(KoosColor.Default),
            selectMenu,
            cancelButton,
        };
    }
}
