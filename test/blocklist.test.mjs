import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateHosts, matchBlocklists, parseBlocklist } from '../extension/src/core/blocklist.js';
import { DomainSet, packDomains } from '../extension/src/core/domainset.js';
import { splitDomain } from '../extension/src/core/hostname.js';

const SAMPLE = `[Adblock Plus 2.0]
! Title: sample list
# another comment style
||flexytalk.net^
||vlc.de^$doc
||audacity.de^$all
||sub.example.org^$all,domain=~allowed.example
||guide.example.net^$doc,to=~edu|~gov
||shop.example.com^
@@||shop.example.com^$doc
||files.example.com^$3p
||cdn.example.com^$script
||popup.example.com^$popup
||01net.com/telecharger/$doc
||wild*.example.com^
||ports.example.com:8080^
||1.2.3.4^
||co.uk^
example.com##.banner
##.ad
site.org#@#.x
/ads?\\./
0.0.0.0 hosts-one.test
127.0.0.1 localhost
0.0.0.0 0.0.0.0
plain-domain.net
plain-two.net # trailing comment
`;

test('parser keeps whole-site rules and skips everything else', () => {
  const { hosts, skipped } = parseBlocklist(SAMPLE);
  assert.deepEqual(hosts.sort(), ['audacity.de', 'flexytalk.net', 'guide.example.net', 'hosts-one.test', 'plain-domain.net', 'plain-two.net', 'sub.example.org', 'vlc.de']);
  assert.ok(skipped >= 10);
});

test('exceptions remove entries; paths, wildcards, ports, IPs and bare suffixes never become entries', () => {
  const { hosts } = parseBlocklist(SAMPLE);
  for (const gone of ['shop.example.com', 'files.example.com', 'cdn.example.com', 'popup.example.com', '01net.com', '1.2.3.4', 'co.uk', 'localhost', '0.0.0.0']) {
    assert.ok(!hosts.includes(gone), gone);
  }
});

test('parser copes with empty and hostile input', () => {
  assert.deepEqual(parseBlocklist('').hosts, []);
  assert.deepEqual(parseBlocklist('\u0000\u0001 ||| ^^^ $$$ @@ ||').hosts, []);
  assert.equal(parseBlocklist('||' + 'a'.repeat(300) + '.com^').hosts.length, 0);
});

test('a rule for a host also covers its subdomains, never its parents', () => {
  assert.deepEqual(candidateHosts('a.b.evil.com', 'evil.com'), ['a.b.evil.com', 'b.evil.com', 'evil.com']);
  assert.deepEqual(candidateHosts('x.evil.co.uk', 'evil.co.uk'), ['x.evil.co.uk', 'evil.co.uk']);
  const lists = [{ id: 't', title: 'T', set: new DomainSet(packDomains(['b.evil.com'])) }];
  assert.equal(matchBlocklists(splitDomain('a.b.evil.com'), lists).host, 'b.evil.com');
  assert.equal(matchBlocklists(splitDomain('b.evil.com'), lists).host, 'b.evil.com');
  assert.equal(matchBlocklists(splitDomain('evil.com'), lists), null);
  assert.equal(matchBlocklists(splitDomain('other.evil.com'), lists), null);
});
