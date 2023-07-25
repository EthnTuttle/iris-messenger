import { sha256 } from '@noble/hashes/sha256';
import { throttle } from 'lodash';
import { Event, Filter, Sub } from 'nostr-tools';

import Helpers from '../Helpers';
import localState from '../LocalState';

import Events from './Events';
import Key from './Key';
import PubSub from './PubSub';

type SavedRelays = {
  [key: string]: {
    enabled?: boolean;
    lastSeen?: number;
  };
};

let savedRelays: SavedRelays = {};

const DEFAULT_RELAYS: RelayMetadata = { enabled: true, url: 'wss://192.168.12.244' };

const SEARCH_RELAYS = ['wss://192.168.12.244'];

type PublicRelaySettings = {
  read: boolean;
  write: boolean;
};
export type RelayMetadata = { enabled: boolean; url: string };

export type PopularRelay = {
  url: string;
  users: number;
};

/**
 * Relay management and subscriptions. Bundles subscriptions in to max 10 larger batches.
 */
const Relays = {
  relays: DEFAULT_RELAYS,
  searchRelays: new Map<string, RelayMetadata>(),
  writeRelaysByUser: new Map<string, Set<string>>(),
  filtersBySubscriptionName: new Map<string, string>(),
  subscribedEventTags: new Set<string>(),
  subscribedProfiles: new Set<string>(),
  subscribedKeywords: new Set<string>(), // seach keywords
  subscriptionsByName: new Map<string, Set<Sub>>(),
  newAuthors: new Set<string>(),
  DEFAULT_RELAYS,
  init() {
    this.relays = DEFAULT_RELAYS;
    this.searchRelays = new Map(SEARCH_RELAYS.map((url) => [url, { enabled: true, url }]));
    this.manage();
  },
  enabledRelays(relays?: RelayMetadata) {
    return relays;
  },
  getSubscriptionIdForName(name: string) {
    return Helpers.arrayToHex(sha256(name)).slice(0, 8);
  },
  // get Map of relayUrl: {read:boolean, write:boolean}
  getUrlsFromFollowEvent(event: Event): Map<string, PublicRelaySettings> {
    const urls = new Map<string, PublicRelaySettings>();
    if (event.content) {
      try {
        const content = JSON.parse(event.content);
        for (const url in content) {
          try {
            const parsed = new URL(url).toString().replace(/\/$/, '');
            urls.set(parsed, content[url]);
          } catch (e) {
            console.log('invalid relay url', url, event);
          }
        }
      } catch (e) {
        console.log('failed to parse relay urls', event);
      }
    }
    return urls;
  },
  getPopularRelays: function (): Array<PopularRelay> {
    console.log('getPopularRelays');
    const relays = new Map<string, number>();
    Events.db.find({ kind: 3 }).forEach((event) => {
      if (event.content) {
        try {
          // content is an object of relayUrl: {read:boolean, write:boolean}
          const content = JSON.parse(event.content);
          for (const url in content) {
            try {
              const parsed = new URL(url).toString().replace(/\/$/, '');
              const count = relays.get(parsed) || 0;
              relays.set(parsed, count + 1);
            } catch (e) {
              console.log('invalid relay url', url, event);
            }
          }
        } catch (e) {
          console.log('failed to parse relay urls', event);
        }
      }
    });
    const sorted = Array.from(relays.entries())
      .filter(([url]) => this.relays.url == url)
      .sort((a, b) => b[1] - a[1]);
    return sorted.map((entry) => {
      return { url: entry[0], users: entry[1] };
    });
  },
  getConnectedRelayCount: function (): number {
    const { url } = this.relays;
    if (PubSub.relayPool.relayByUrl.get(url)?.status === 1) {
      return 1;
    }
    return 0;
  },
  getUserRelays(user: string): Array<[string, PublicRelaySettings]> {
    let relays = new Map<string, PublicRelaySettings>();
    if (typeof user !== 'string') {
      console.log('getUserRelays: invalid user', user);
      return [];
    }
    const followEvent = Events.db.findOne({ kind: 3, pubkey: user });
    if (followEvent) {
      relays = this.getUrlsFromFollowEvent(followEvent);
    }
    return Array.from(relays.entries());
  },
  manage: function () {
    localState.get('relays').put({});
    localState.get('relays').on((r: SavedRelays) => {
      if (!r) {
        return;
      }
      savedRelays = r;
      const { url } = this.relays;
      if (savedRelays[url] === null) {
        this.remove(url);
      } else if (savedRelays[url] && savedRelays[url].enabled === false) {
        const r = this.relays;
        if (r) {
          r.enabled = false;
          this.relays = r;
          PubSub.relayPool.removeRelay(url);
        }
      }
      for (const [url, data] of Object.entries(savedRelays)) {
        if (!data) {
          this.relays && this.remove(url);
          continue;
        } else if (!this.relays.url) {
          // `data` was missing `url` here, and those objects would be stored.
          // So this is backward compat.
          this.relays.enabled = !!data.enabled;
          if (data.enabled) {
            PubSub.relayPool.addOrGetRelay(url);
          }
        }
      }
    });
  },
  add(url: string) {
    if (this.relays.url === url) return;
    const relay = { enabled: true, url };
    this.relays = relay;
    PubSub.relayPool.addOrGetRelay(url);
  },
  remove(url: string) {
    try {
      PubSub.relayPool.removeRelay(url);
    } catch (e) {
      console.log('error closing relay', e);
    }
    this.relays = {} as RelayMetadata;
  },
  disable(url: string) {
    if (!(this.relays.url === url)) {
      return;
    }
    this.relays.enabled = false;
    PubSub.relayPool.removeRelay(url);
  },
  enable(url: string) {
    if (!(this.relays.url === url)) {
      return;
    }
    this.relays.set(url, { enabled: true, url });
    PubSub.relayPool.addOrGetRelay(url);
  },
  restoreDefaults() {
    this.relays = DEFAULT_RELAYS;
    this.saveToContacts();
    // do not save these to contact list
    for (const url of SEARCH_RELAYS) {
      if (!(this.relays.url === url)) this.add(url);
    }
    const relaysObj = {};
    this.relays.enabled = true;
    localState.get('relays').put(relaysObj);
  },
  saveToContacts() {
    const relaysObj: any = {};
    relaysObj[this.relays.url] = { read: true, write: true };
    const existing = Events.db.findOne({ kind: 3, pubkey: Key.getPubKey() });
    const content = JSON.stringify(relaysObj);

    const event = {
      kind: 3,
      content,
      tags: existing?.tags || [],
    };
    Events.publish(event);
  },
  updateLastSeen: throttle(
    (url) => {
      const now = Math.floor(Date.now() / 1000);
      localState.get('relays').get(url).get('lastSeen').put(now);
    },
    5 * 1000,
    { leading: true },
  ),
  groupFilter(filter: Filter): { name: string; groupedFilter: Filter } {
    // if filter has authors, add to subscribedAuthors and group by authors
    if (filter.authors && filter.kinds?.length === 1 && filter.kinds[0] === 0) {
      filter.authors.forEach((a) => {
        this.subscribedProfiles.add(a);
      });
      return {
        name: 'profiles',
        groupedFilter: {
          authors: Array.from(this.subscribedProfiles.values()),
          kinds: [0],
        },
      };
    }
    if (filter.authors) {
      filter.authors = Array.from(this.subscribedProfiles.values());
      return {
        name: 'authors',
        groupedFilter: {
          authors: Array.from(this.subscribedProfiles.values()),
        },
      };
    }
    if (filter.ids) {
      return {
        name: 'ids',
        groupedFilter: { ids: Array.from(PubSub.subscribedEventIds.values()) },
      };
    }
    if (filter['#e']) {
      filter['#e'].forEach((e) => {
        this.subscribedEventTags.add(e);
      });
      return {
        name: 'eventsByTag',
        groupedFilter: { '#e': Array.from(this.subscribedEventTags.values()) },
      };
    }
    // do not bundle. TODO console.log, limit or sth
    return {
      name: JSON.stringify(filter),
      groupedFilter: filter,
    };
  },
};

if (window.location.pathname !== '/') {
  Relays.init();
}

export default Relays;
