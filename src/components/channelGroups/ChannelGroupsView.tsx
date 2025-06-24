import React, { type FC } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useGetChannelGroupsView } from 'hooks/api/liveTvHooks/useGetChannelGroupsView';
import Card from 'components/cardbuilder/Card/Card';
import type { CardOptions } from 'types/cardOptions';
import { CardShape } from 'utils/card';
import globalize from 'lib/globalize';

interface ChannelGroupsViewProps {
    userId?: string;
    startIndex?: number;
    limit?: number;
    cardOptions?: CardOptions;
}

const ChannelGroupsView: FC<ChannelGroupsViewProps> = ({
    userId,
    startIndex,
    limit,
    cardOptions = {}
}) => {
    const { data: channelGroups, isLoading, error } = useGetChannelGroupsView({
        userId,
        startIndex,
        limit
    });

    if (isLoading) {
        return (
            <Box>
                <Typography>{globalize.translate('Loading')}</Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Box>
                <Typography color="error">
                    {globalize.translate('ErrorLoadingChannels')}
                </Typography>
            </Box>
        );
    }

    if (!channelGroups || channelGroups.length === 0) {
        return (
            <Box>
                <Typography>{globalize.translate('NoChannelsFound')}</Typography>
            </Box>
        );
    }

    return (
        <Box>
            {channelGroups.map((group, index) => (
                <Box key={`${group.name}-${index}`} sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2, pl: 1 }}>
                        {group.name} ({group.totalCount})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {group.channels.map((channel) => (
                            <Card
                                key={channel.Id}
                                item={channel}
                                cardOptions={{
                                    shape: CardShape.Square,
                                    showTitle: true,
                                    lazy: true,
                                    cardLayout: true,
                                    showDetailsMenu: true,
                                    showCurrentProgram: true,
                                    showCurrentProgramTime: true,
                                    ...cardOptions
                                }}
                            />
                        ))}
                    </Box>
                </Box>
            ))}
        </Box>
    );
};

export default ChannelGroupsView; 