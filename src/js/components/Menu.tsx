import { useEffect, useState } from 'react';
import {
  Cog8ToothIcon,
  HomeIcon,
  InformationCircleIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import {
  Cog8ToothIcon as Cog8ToothIconFull,
  HomeIcon as HomeIconFull,
  InformationCircleIcon as InformationCircleIconFull,
  MagnifyingGlassIcon,
  PaperAirplaneIcon as PaperAirplaneIconFull,
  PlusIcon,
} from '@heroicons/react/24/solid';
import { Link, route } from 'preact-router';

import Icons from '../Icons';
import localState from '../LocalState';
import Key from '../nostr/Key';
import { translate as t } from '../translations/Translation.mjs';

import Show from './helpers/Show';
import Modal from './modal/Modal';
import Avatar from './Avatar';
import Name from './Name';
import PublicMessageForm from './PublicMessageForm';

const MENU_ITEMS = [
  { url: '/', text: 'home', icon: HomeIcon, activeIcon: HomeIconFull },
  {
    url: '/search',
    text: 'search',
    icon: MagnifyingGlassIcon,
    activeIcon: Icons.magnifyingGlassBold,
  },
  {
    url: '/chat',
    text: 'messages',
    icon: PaperAirplaneIcon,
    activeIcon: PaperAirplaneIconFull,
  },
  {
    url: '/settings',
    text: 'settings',
    icon: Cog8ToothIcon,
    activeIcon: Cog8ToothIconFull,
  },
  {
    url: '/about',
    text: 'about',
    icon: InformationCircleIcon,
    activeIcon: InformationCircleIconFull,
  },
];

export default function Menu() {
  const [unseenMsgsTotal, setUnseenMsgsTotal] = useState(0);
  const [activeRoute, setActiveRoute] = useState('');
  const [showNewPostModal, setShowNewPostModal] = useState(false);

  useEffect(() => {
    const unsubscribeUnseenMsgsTotal = localState.get('unseenMsgsTotal').on(setUnseenMsgsTotal);
    const unsubscribeActiveRoute = localState.get('activeRoute').on(setActiveRoute);
    return () => {
      unsubscribeUnseenMsgsTotal();
      unsubscribeActiveRoute();
    };
  }, []);

  const menuLinkClicked = (e, a?, openFeed = false) => {
    if (a?.text === 'home' || openFeed) {
      openFeedClicked(e);
    }
    localState.get('scrollUp').put(true);
  };

  const openFeedClicked = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localState.get('lastOpenedFeed').once((lastOpenedFeed: string) => {
      if (lastOpenedFeed !== activeRoute.replace('/', '')) {
        route('/' + (lastOpenedFeed || ''));
      } else {
        localState.get('lastOpenedFeed').put('');
        route('/');
      }
    });
  };

  const renderNewPostModal = () => (
    <Modal centerVertically={true} showContainer={true} onClose={() => setShowNewPostModal(false)}>
      <PublicMessageForm
        onSubmit={() => setShowNewPostModal(false)}
        placeholder={t('whats_on_your_mind')}
        autofocus={true}
      />
    </Modal>
  );

  const renderProfileLink = () => {
    const hex = Key.getPubKey();
    const npub = Key.toNostrBech32Address(hex, 'npub');
    return (
      <div>
        <Link href={`/${npub}`} className="btn btn-ghost md:max-xl:btn-circle">
          <Avatar str={hex} width={34} />
          <div className="hidden xl:block ml-2">
            <Name pub={hex} hideBadge={true} />
          </div>
        </Link>
      </div>
    );
  };

  const renderMenuItem = (a) => {
    const isActive = a.url === activeRoute;
    const Icon = isActive ? a.activeIcon : a.icon;
    return (
      <div>
        <a
          onClick={(e) => menuLinkClicked(e, a)}
          className={`${
            isActive ? 'active' : ''
          } inline-flex w-auto flex items-center space-x-4 p-3 rounded-full transition-colors duration-200 hover:bg-neutral-900`}
          href={a.url}
        >
          <Show when={a.text === 'messages' && unseenMsgsTotal}>
            <span class="unseen unseen-total">{unseenMsgsTotal}</span>
          </Show>
          <Icon width={24} />
          <span className="hidden xl:flex">{t(a.text)}</span>
        </a>
      </div>
    );
  };

  return (
    <div className="sticky top-0 z-20 h-screen max-h-screen hidden md:w-16 xl:w-56 flex-col px-2 py-4 md:flex flex-shrink-0">
      <a
        className="flex items-center gap-3 px-2 mb-4"
        tabIndex={3}
        href="/"
        onClick={(e) => menuLinkClicked(e, undefined, true)}
      >
        <img src="/img/icon128.png" width="30" height="30" />
        <h1 className="hidden xl:flex text-3xl">iris</h1>
      </a>
      {MENU_ITEMS.map((a: any) => renderMenuItem(a))}
      <div class="py-2 flex-1">
        <button
          className="btn btn-primary md:max-xl:btn-circle"
          onClick={() => setShowNewPostModal(!showNewPostModal)}
        >
          <PlusIcon width={24} />
          <span className="hidden xl:flex">{t('new_post')}</span>
        </button>
        <Show when={showNewPostModal}>{renderNewPostModal()}</Show>
      </div>
      {renderProfileLink()}
    </div>
  );
}
