import cardBuilder from '../../components/cardbuilder/cardBuilder';
import imageLoader from '../../components/images/imageLoader';
import libraryBrowser from '../../scripts/libraryBrowser';
import loading from '../../components/loading/loading';
import { Events } from 'jellyfin-apiclient';
import * as userSettings from '../../scripts/settings/userSettings';
import '../../elements/emby-itemscontainer/emby-itemscontainer';

export default function (view, params, tabContent) {
    function getPageData() {
        if (!pageData) {
            pageData = {
                query: {
                    StartIndex: 0,
                    Fields: 'PrimaryImageAspectRatio',
                    groupName: '全部'
                }
            };
        }

        if (userSettings.libraryPageSize() > 0) {
            pageData.query['Limit'] = 2000; //userSettings.libraryPageSize();
        }

        return pageData;
    }

    function getQuery() {
        return getPageData().query;
    }

    function getChannelsHtml(channels, query) {
        console.log(query.groupName);

        channels = channels.filter(e => {
            let groupName = query.groupName;
            if (groupName == '全部') {
                return true;
            }

            if (groupName == '未分类') {
                groupName = null;
            }
            return e.ChannelGroup == groupName;
        });

        return cardBuilder.getCardsHtml({
            items: channels,
            shape: 'square',
            showTitle: true,
            lazy: true,
            cardLayout: true,
            showDetailsMenu: true,
            showCurrentProgram: true,
            showCurrentProgramTime: true
        });
    }

    function getGroupHtml(channels) {
        // const fmt = `<div id="upcomingKids" class="verticalSection">
        //         <div class="sectionTitleContainer sectionTitleContainer-cards padded-left">
        //             <a href="#/list.html?type=Programs&IsKids=true" is="emby-linkbutton" class="button-flat button-flat-mini sectionTitleTextButton sectionTitleTextButton-programs">
        //                 <h2 class="sectionTitle sectionTitle-cards" style="display: inline-block; vertical-align: middle;">${HeaderForKids}</h2>
        //                 <span class="material-icons chevron_right" aria-hidden="true"></span>
        //             </a>
        //         </div>
        //         <div is="emby-itemscontainer" class="upcomingKidsItems itemsContainer padded-left padded-right"></div>
        //     </div>`;
        let html = '';
        for (const chan of channels) {
            const groupName = chan;

            html += `<div class="verticalSection">
                <div class="sectionTitleContainer sectionTitleContainer-cards padded-left">
                    <a style="cursor:pointer" class="group-button button-flat button-flat-mini sectionTitleTextButton sectionTitleTextButton-programs">
                        <h2 class="sectionTitle sectionTitle-cards" style="display: inline-block; vertical-align: middle;">${groupName}</h2>
                    </a>
                </div>
            </div>`;
        }

        return html;
    }

    function renderChannels(context, result) {
        function onNextPageClick() {
            if (isLoading) {
                return;
            }

            if (userSettings.libraryPageSize() > 0) {
                query.StartIndex += query.Limit;
            }
            reloadItems(context).then(() => {
                window.scrollTo(0, 0);
            });
        }

        function onPreviousPageClick() {
            if (isLoading) {
                return;
            }

            if (userSettings.libraryPageSize() > 0) {
                query.StartIndex = Math.max(0, query.StartIndex - query.Limit);
            }
            reloadItems(context).then(() => {
                window.scrollTo(0, 0);
            });
        }

        function onGroupButton(e) {
            if (isLoading) {
                return;
            }

            if (userSettings.libraryPageSize() > 0) {
                query.StartIndex = Math.max(0, query.StartIndex - query.Limit);
            }

            const groupName = e.target.innerHTML;
            query.groupName = groupName;

            reloadItems(context).then(() => {
                window.scrollTo(0, 0);
            });
        }

        const query = getQuery();

        // for (const elem of context.querySelectorAll('.paging')) {
        //     elem.innerHTML = libraryBrowser.getQueryPagingHtml({
        //         startIndex: query.StartIndex,
        //         limit: query.Limit,
        //         totalRecordCount: result.TotalRecordCount,
        //         showLimit: false,
        //         updatePageSizeSetting: false,
        //         filterButton: false
        //     });
        // }

        //group
        const groups = new Set(['全部']);
        for (const item of result.Items) {
            if (item.ChannelGroup) {
                groups.add(item.ChannelGroup);
            }
        }
        groups.add('未分类');

        const group_html = getGroupHtml(groups);
        const group_elem = context.querySelector('#group');
        group_elem.innerHTML = group_html;
        imageLoader.lazyChildren(group_elem);

        const html = getChannelsHtml(result.Items, query);
        const elem = context.querySelector('#items');
        elem.innerHTML = html;
        imageLoader.lazyChildren(elem);
        let i;
        let length;
        let elems;

        for (elems = context.querySelectorAll('.btnNextPage'), i = 0, length = elems.length; i < length; i++) {
            elems[i].addEventListener('click', onNextPageClick);
        }

        for (elems = context.querySelectorAll('.btnPreviousPage'), i = 0, length = elems.length; i < length; i++) {
            elems[i].addEventListener('click', onPreviousPageClick);
        }

        for (elems = context.querySelectorAll('.group-button'), i = 0, length = elems.length; i < length; i++) {
            elems[i].addEventListener('click', onGroupButton);
        }
    }

    function showFilterMenu(context) {
        import('../../components/filterdialog/filterdialog').then(({default: FilterDialog}) => {
            const filterDialog = new FilterDialog({
                query: getQuery(),
                mode: 'livetvchannels',
                serverId: ApiClient.serverId()
            });
            Events.on(filterDialog, 'filterchange', function () {
                reloadItems(context);
            });
            filterDialog.show();
        });
    }

    function reloadItems(context) {
        loading.show();
        isLoading = true;
        const query = getQuery();
        const apiClient = ApiClient;
        query.UserId = apiClient.getCurrentUserId();
        return apiClient.getLiveTvChannels(query).then(function (result) {
            renderChannels(context, result);
            loading.hide();
            isLoading = false;

            import('../../components/autoFocuser').then(({default: autoFocuser}) => {
                autoFocuser.autoFocus(context);
            });
        });
    }

    let pageData;
    const self = this;
    let isLoading = false;
    tabContent.querySelector('.btnFilter').addEventListener('click', function () {
        showFilterMenu(tabContent);
    });

    self.renderTab = function () {
        reloadItems(tabContent);
    };
}
