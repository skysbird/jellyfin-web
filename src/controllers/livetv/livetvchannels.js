import cardBuilder from '../../components/cardbuilder/cardBuilder';
import imageLoader from '../../components/images/imageLoader';
import libraryBrowser from '../../scripts/libraryBrowser';
import loading from '../../components/loading/loading';
import * as userSettings from '../../scripts/settings/userSettings';
import Events from '../../utils/events.ts';
import { setFilterStatus } from 'components/filterdialog/filterIndicator';
import globalize from '../../lib/globalize';

import '../../elements/emby-itemscontainer/emby-itemscontainer';

// 工具函数：将对象转为URL查询字符串
function buildQueryString(params) {
    if (!params) return '';
    const esc = encodeURIComponent;
    const query = Object.keys(params)
        .filter(k => params[k] !== undefined && params[k] !== null)
        .map(k => esc(k) + '=' + esc(params[k]))
        .join('&');
    return query ? '?' + query : '';
}

export default function (view, params, tabContent) {
    function getPageData() {
        if (!pageData) {
            pageData = {
                query: {
                    StartIndex: 0,
                    Fields: 'PrimaryImageAspectRatio'
                },
                useChannelGroups: true
            };
        }

        if (userSettings.libraryPageSize() > 0) {
            pageData.query['Limit'] = userSettings.libraryPageSize();
        }

        return pageData;
    }

    function getQuery() {
        return getPageData().query;
    }

    function getChannelsHtml(channels) {
        // 保证 channels 一定是数组
        if (!Array.isArray(channels)) {
            channels = [];
        }
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

    function getChannelGroupsHtml(channelGroups) {
        if (!Array.isArray(channelGroups) || channelGroups.length === 0) {
            return '<div style="text-align:center;color:#888;padding:2em;">暂无频道组数据</div>';
        }
        let html = '';
        channelGroups.forEach((group, idx) => {
            const groupId = 'channelGroup_' + idx;
            html += `<div class="channelGroup" id="${groupId}">
                <h3 class="channelGroupTitle" style="cursor:pointer;" data-group-index="${idx}">
                    ${group.Name || '未命名组'} (${group.TotalCount || 0})
                    <span class="expand-indicator" style="margin-left:8px;">&#9654;</span>
                </h3>
                <div class="channelGroupContent" style="display:none;"></div>
            </div>`;
        });
        return html;
    }

    // 分组内频道分页状态缓存
    const groupPagingState = {};

    function bindGroupExpandEvents(context, channelGroups) {
        const titles = context.querySelectorAll('.channelGroupTitle');
        titles.forEach(title => {
            title.addEventListener('click', function () {
                const idx = this.getAttribute('data-group-index');
                const group = channelGroups[idx];
                const groupElem = this.parentElement;
                const contentElem = groupElem.querySelector('.channelGroupContent');
                const indicator = this.querySelector('.expand-indicator');
                if (contentElem.style.display === 'none') {
                    // 展开，加载第一页
                    groupPagingState[group.Name] = { startIndex: 0, limit: 20 };
                    loadGroupPage(group, contentElem, indicator);
                } else {
                    // 收起，重置分页
                    contentElem.style.display = 'none';
                    indicator.innerHTML = '&#9654;';
                    groupPagingState[group.Name] = { startIndex: 0, limit: 20 };
                }
            });
        });
    }

    function loadGroupPage(group, contentElem, indicator) {
        const paging = groupPagingState[group.Name] || { startIndex: 0, limit: 20 };
        contentElem.innerHTML = '<div style="color:#888;padding:1em;">加载中...</div>';
        contentElem.style.display = '';
        indicator.innerHTML = '&#9660;';
        // 请求该组频道
        const apiClient = ApiClient;
        const query = getQuery();
        query.UserId = apiClient.getCurrentUserId();
        query.Limit = paging.limit;
        query.StartIndex = paging.startIndex;
        apiClient.ajax({
            type: 'GET',
            url: apiClient.getUrl('LiveTv/Channels/Groups') + buildQueryString(query)
        }).then(function (response) {
            if (response && typeof response.json === 'function') {
                return response.json();
            }
            return response;
        }).then(function (result) {
            // 找到当前组
            const found = Array.isArray(result) ? result.find(g => g.Name === group.Name) : null;
            if (found && Array.isArray(found.Channels)) {
                let html = getChannelsHtml(found.Channels);
                // 分页按钮
                html += renderGroupPaging(group, found, paging);
                contentElem.innerHTML = html;
                imageLoader.lazyChildren(contentElem);
                // 绑定分页按钮事件
                const prevBtn = contentElem.querySelector('.btnGroupPrevPage');
                const nextBtn = contentElem.querySelector('.btnGroupNextPage');
                if (prevBtn) {
                    prevBtn.addEventListener('click', function () {
                        if (paging.startIndex >= paging.limit) {
                            paging.startIndex -= paging.limit;
                            loadGroupPage(group, contentElem, indicator);
                        }
                    });
                }
                if (nextBtn) {
                    nextBtn.addEventListener('click', function () {
                        if (paging.startIndex + paging.limit < found.TotalCount) {
                            paging.startIndex += paging.limit;
                            loadGroupPage(group, contentElem, indicator);
                        }
                    });
                }
            } else {
                contentElem.innerHTML = '<div style="color:#888;padding:1em;">暂无频道</div>';
            }
        });
    }

    function renderGroupPaging(group, found, paging) {
        const start = paging.startIndex + 1;
        const end = Math.min(paging.startIndex + paging.limit, found.TotalCount);
        const total = found.TotalCount;
        let html = `<div class="groupPaging" style="margin:1em 0;display:flex;align-items:center;gap:1em;justify-content:center;">
            <button class="btnGroupPrevPage" ${paging.startIndex === 0 ? 'disabled' : ''}>上一页</button>
            <span>${start}-${end} / ${total}</span>
            <button class="btnGroupNextPage" ${(paging.startIndex + paging.limit) >= total ? 'disabled' : ''}>下一页</button>
        </div>`;
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

        const query = getQuery();
        const pageData = getPageData();

        // 只在非频道组模式下渲染分页控件
        if (!pageData.useChannelGroups && result && typeof result === 'object') {
            for (const elem of context.querySelectorAll('.paging')) {
                elem.innerHTML = libraryBrowser.getQueryPagingHtml({
                    startIndex: query.StartIndex,
                    limit: query.Limit,
                    totalRecordCount: result.TotalRecordCount,
                    showLimit: false,
                    updatePageSizeSetting: false,
                    filterButton: false
                });
            }
        } else {
            // 频道组模式下清空分页控件
            for (const elem of context.querySelectorAll('.paging')) {
                elem.innerHTML = '';
            }
        }

        let html;
        if (pageData.useChannelGroups && Array.isArray(result)) {
            html = getChannelGroupsHtml(result);
        } else {
            html = getChannelsHtml(result.Items || result);
        }
        
        const elem = context.querySelector('#items');
        elem.innerHTML = html;
        imageLoader.lazyChildren(elem);

        // 新增：频道组模式下绑定展开事件
        if (pageData.useChannelGroups && Array.isArray(result)) {
            bindGroupExpandEvents(context, result);
        }
        let i;
        let length;
        let elems;

        for (elems = context.querySelectorAll('.btnNextPage'), i = 0, length = elems.length; i < length; i++) {
            elems[i].addEventListener('click', onNextPageClick);
        }

        for (elems = context.querySelectorAll('.btnPreviousPage'), i = 0, length = elems.length; i < length; i++) {
            elems[i].addEventListener('click', onPreviousPageClick);
        }
    }

    function showFilterMenu(context) {
        import('../../components/filterdialog/filterdialog').then(({ default: FilterDialog }) => {
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
        const pageData = getPageData();
        setFilterStatus(context, query);

        const apiClient = ApiClient;
        query.UserId = apiClient.getCurrentUserId();
        let promise;
        if (pageData.useChannelGroups) {
            // 初始只取分组信息，不取频道
            const groupQuery = { ...query, Limit: 1 };
            const url = apiClient.getUrl('LiveTv/Channels/Groups') + buildQueryString(groupQuery);
            promise = apiClient.ajax({
                type: 'GET',
                url: url
            });
        } else {
            promise = apiClient.getLiveTvChannels(query);
        }
        return promise.then(function (response) {
            if (response && typeof response.json === 'function') {
                return response.json();
            }
            return response;
        }).then(function (result) {
            renderChannels(context, result);
            loading.hide();
            isLoading = false;

            import('../../components/autoFocuser').then(({ default: autoFocuser }) => {
                autoFocuser.autoFocus(context);
            });
        });
    }

    function toggleDisplayMode(context) {
        const pageData = getPageData();
        pageData.useChannelGroups = !pageData.useChannelGroups;
        
        // 更新按钮状态
        const toggleButton = context.querySelector('.btnToggleGroups');
        if (toggleButton) {
            if (pageData.useChannelGroups) {
                toggleButton.classList.add('active');
                toggleButton.querySelector('.material-icons').textContent = 'grid_view';
                toggleButton.title = globalize.translate('ShowChannelList');
            } else {
                toggleButton.classList.remove('active');
                toggleButton.querySelector('.material-icons').textContent = 'view_list';
                toggleButton.title = globalize.translate('ShowChannelGroups');
            }
        }
        
        reloadItems(context);
    }

    let pageData;
    const self = this;
    let isLoading = false;
    
    const toggleButton = tabContent.querySelector('.btnToggleGroups');
    if (toggleButton) {
        // 设置初始状态为频道组模式
        toggleButton.classList.add('active');
        toggleButton.querySelector('.material-icons').textContent = 'grid_view';
        toggleButton.title = globalize.translate('ShowChannelList');
        
        toggleButton.addEventListener('click', function () {
            toggleDisplayMode(tabContent);
        });
    }
    
    tabContent.querySelector('.btnFilter').addEventListener('click', function () {
        showFilterMenu(tabContent);
    });

    self.renderTab = function () {
        reloadItems(tabContent);
    };
}
