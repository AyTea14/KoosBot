import { envParseString } from "@skyra/env-utilities";
import { KoosColor } from "#utils/constants";
import { deleteNp, deletePrevious, getNp, time } from "#utils/functions";
import { ApplyOptions } from "@sapphire/decorators";
import { container, Listener } from "@sapphire/framework";
import { isNullish } from "@sapphire/utilities";
import { Guild, Message, ButtonBuilder, EmbedBuilder, ButtonStyle, ComponentType } from "discord.js";
import { Events, KazagumoPlayer } from "kazagumo";
import ms from "ms";

@ApplyOptions<Listener.Options>({
    emitter: container.kazagumo,
    name: `kazagumo:${Events.PlayerEmpty}`,
    event: Events.PlayerEmpty,
})
export class ClientListener extends Listener {
    timeoutId: NodeJS.Timeout | undefined;
    leaveAfter: number = envParseString("NODE_ENV") === "production" ? time("mins", 3) : time("sec", 25);

    public async run(player: KazagumoPlayer) {
        const { client } = this.container;
        const guild = client.guilds.cache.get(player.guildId) ?? (await client.guilds.fetch(player.guildId).catch(() => null));
        const channel = client.channels.cache.get(player.textId) ?? (await client.channels.fetch(player.textId).catch(() => null));
        if (isNullish(guild) || isNullish(player) || isNullish(channel)) return;

        if (player.queue.current) return;

        const npMessage = getNp(player);
        console.log("ran");

        if (channel && channel.isTextBased() && npMessage instanceof Message) {
            const msg = channel.messages.cache.get(npMessage.id) ?? (await channel.messages.fetch(npMessage.id).catch(() => null));

            if (!isNullish(msg) && msg.editable) {
                // const row = npMessage.components;
                // const disabled = row[0].components.map((component) =>
                //     new ButtonBuilder(component.data).setStyle(ButtonStyle.Secondary).setDisabled(true)
                // );

                msg.edit({ components: [] });
                deleteNp(player);
                deletePrevious(player);
            }
        }
        // if (channel.isText()) channel.send({ embeds: [{ description: "There are no more tracks", color: embedColor.error }] });

        await this.setup(guild, player);
        return;
    }

    async setup(guild: Guild | null, player: KazagumoPlayer) {
        if (typeof this.timeoutId !== "undefined") this.cancel();

        const { client, kazagumo } = this.container;
        const channel =
            container.client.channels.cache.get(player.textId) ?? (await client.channels.fetch(player.textId).catch(() => null));
        if (isNullish(guild) || isNullish(player) || isNullish(channel)) return this.cancel();

        this.timeoutId = setTimeout(() => {
            const player = kazagumo.getPlayer(guild.id);
            if (isNullish(player)) return this.cancel();
            if (player.queue.current) return this.cancel();
            if (!player.queue.isEmpty && isNullish(guild.members.me?.voice.channelId)) return this.cancel();
            if (!channel.isTextBased()) return this.cancel();

            player.destroy();
            channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`No tracks have been playing for the past ${ms(this.leaveAfter, { long: true })}, leaving.`)
                        .setColor(KoosColor.Error),
                ],
            });
        }, this.leaveAfter);
    }
    reset() {
        this.timeoutId = undefined;
    }
    cancel() {
        clearTimeout(this.timeoutId);
        this.reset();
    }
}
