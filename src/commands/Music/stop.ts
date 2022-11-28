import { embedColor } from "#utils/constants";
import { ApplyOptions } from "@sapphire/decorators";
import { Command } from "@sapphire/framework";
import { reply, send } from "@sapphire/plugin-editable-commands";
import { Message, GuildMember } from "discord.js";

@ApplyOptions<Command.Options>({
    description: "Stops and disconnects the player.",
})
export class UserCommand extends Command {
    public async messageRun(message: Message) {
        const { kazagumo } = this.container;
        const player = kazagumo.getPlayer(`${message.guildId}`);
        const member = message.member as GuildMember;
        const channel = member.voice.channel;

        if (!channel)
            return reply(message, { embeds: [{ description: "You aren't connected to a voice channel", color: embedColor.red }] });

        if (!player || (player && !player.queue.current)) {
            return reply(message, {
                embeds: [{ description: "There's nothing playing in this server", color: embedColor.red }],
            });
        }

        try {
            player.destroy();
            send(message, { embeds: [{ description: `Destroyed the player and left the voice channel`, color: embedColor.green }] });
        } catch (error) {
            this.container.logger.error(error);
        }
    }
}
