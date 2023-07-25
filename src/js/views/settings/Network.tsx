import { useEffect, useState } from 'preact/compat';

import localState from '../../LocalState';
import PubSub from '../../nostr/PubSub';
import Relays from '../../nostr/Relays';
import { translate as t } from '../../translations/Translation.mjs';

const Network = () => {
  const [relays, setRelays] = useState(Relays.relays);
  const [newRelayUrl, setNewRelayUrl] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setRelays(Relays.relays);
    }, 2000);
    return () => clearInterval(interval);
  });

  const ensureProtocol = (relay) => {
    if (relay.includes('://')) return relay;

    return `wss://${relay}`;
  };

  const handleAddRelay = (event, url) => {
    const newRelayUrlWithProtocol = ensureProtocol(url);
    localState.get('relays').put({ enabled: true, newRelayUrlWithProtocol });
    event.preventDefault(); // prevent the form from reloading the page
    Relays.add(newRelayUrlWithProtocol); // add the new relay using the Nostr method
    setNewRelayUrl(''); // reset the new relay URL
  };

  const getStatus = (relay) => {
    try {
      return PubSub.relayPool.relayByUrl.get(relay.url).status;
    } catch (e) {
      return 3;
    }
  };

  const getClassName = (relay) => {
    switch (getStatus(relay)) {
      case 0:
        return 'text-iris-yellow';
      case 1:
        return 'text-iris-green';
      case 2:
        return 'text-iris-yellow';
      case 3:
        return '';
      default:
        return 'status';
    }
  };

  return (
    <div className="centered-container">
      <h2>{t('network')}</h2>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 flex-row peer">
          <div className="flex-1" key={relays.url}>
            <span className={getClassName(relays)}>&#x2B24; </span>
            {relays.url}
          </div>
          <input
            className="checkbox"
            type="checkbox"
            checked={relays.enabled !== false}
            onChange={() => {
              relays.enabled = !(relays.enabled !== false);
              relays.enabled ? Relays.enable(relays.url) : Relays.disable(relays.url);
            }}
          />
        </div>
        <div className="flex flex-row peer gap-2">
          <div className="flex-cell" key="new">
            <input
              className="input"
              id="new-relay-url"
              type="text"
              placeholder={t('new_relay_url')}
              value={newRelayUrl}
              onChange={(event) => setNewRelayUrl((event.target as HTMLInputElement).value)}
            />
          </div>
          <div className="flex-cell no-flex">
            <button className="btn btn-neutral" onClick={(e) => handleAddRelay(e, newRelayUrl)}>
              {t('update')}
            </button>
          </div>
        </div>
        <div className="flex gap-2 my-2">
          <button className="btn btn-neutral" onClick={() => Relays.restoreDefaults()}>
            {t('restore_defaults')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Network;
