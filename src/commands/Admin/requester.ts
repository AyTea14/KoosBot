import { KoosCommand } from "#lib/extensions";
import { Emoji } from "#lib/utils/constants";
import { KoosColor } from "#utils/constants";
import { sendLoadingMessage } from "#utils/functions";
import { ApplyOptions } from "@sapphire/decorators";
import { Args } from "@sapphire/framework";
import { send } from "@sapphire/plugin-editable-commands";
import { EmbedBuilder, Message, PermissionFlagsBits } from "discord.js";

@ApplyOptions<KoosCommand.Options>({
    description: "Enables or disables if the requester is shown on each track.",
    permissions: [PermissionFlagsBits.ManageGuild],
    preconditions: ["Administrator"],
    aliases: ["req"],
    detailedDescription: {
        usage: [":enable|:disable"],
    },
})
export class RequesterCommand extends KoosCommand {
    public override registerApplicationCommands(registery: KoosCommand.Registry) {
        registery.registerChatInputCommand((builder) =>
            builder //
                .setName(this.name)
                .setDescription(this.description)
                .addBooleanOption((option) =>
                    option //
                        .setName("enable")
                        .setDescription(this.description)
                        .setRequired(true)
                )
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        );
    }

    public async chatInputRun(interaction: KoosCommand.ChatInputCommandInteraction) {
        const enable = interaction.options.getBoolean("enable")!;

        await interaction.deferReply();
        interaction.followUp({ embeds: [await this.requester(interaction.guildId!, enable)] });
    }

    public async messageRun(message: Message, args: Args) {
        const options = ["enable", "disable", "true", "false"];
        const input = await args.pickResult("enum", { enum: options, caseInsensitive: true });

        let error = input.isErr() ? input.unwrapErr().identifier : undefined;

        if (error === "argsMissing")
            return send(message, {
                embeds: [new EmbedBuilder().setDescription(`Please enter an input.`).setColor(KoosColor.Error)],
            });
        if (error === "enumError")
            return send(message, {
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`Please enter a correct input. (${options.join(", ")})`)
                        .setColor(KoosColor.Error),
                ],
            });
        await sendLoadingMessage(message);

        let enable: boolean;
        if (input.isOk() && ["enable", "true"].includes(input.unwrap().toLowerCase())) enable = true;
        else enable = false;

        send(message, { embeds: [await this.requester(message.guildId!, enable)] });
    }

    private async requester(guildId: string, enable: boolean) {
        const { db } = this.container;

        const { requester } = await db.guild.upsert({
            where: { id: guildId },
            update: { requester: enable },
            create: { id: guildId, requester: enable },
            select: { requester: true },
        });

        return new EmbedBuilder()
            .setDescription(
                requester
                    ? `${Emoji.Yes} Requester will be shown permanently on each track.`
                    : `${Emoji.No} Requester is no longer shown permanently on each track.`
            )
            .setColor(requester ? KoosColor.Success : KoosColor.Error);
    }
}
