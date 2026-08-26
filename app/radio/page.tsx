import RadioClient from './RadioClient';

/**
 * The album list is fetched by RadioClient on mount, NOT here.
 *
 * This page used to `fetch('/api/albums-fast?limit=1000')` on the server and
 * pass the result to RadioClient as a prop. Every album, with its full track
 * payload, was then serialized into the RSC flight document — the build logged
 * a 12.89 MB response for that URL, and all of it had to be downloaded and
 * parsed before the page could paint. `next: { revalidate: 300 }` cached the
 * server fetch and did nothing at all for the client transfer.
 *
 * RadioClient only ever handed the list to `setInitialAlbums`, and it already
 * carries retry logic for the case where albums are not ready when the user
 * presses play, so nothing needed the data to arrive with the HTML.
 */
export default function RadioPage() {
  return <RadioClient />;
}
