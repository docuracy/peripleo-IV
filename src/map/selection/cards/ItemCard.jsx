import React, {useContext, useEffect, useRef, useState} from 'react';
import {BiLink} from 'react-icons/bi';
import {
    IoArrowBackOutline,
    IoCloseSharp,
    IoPinSharp,
    IoSaveSharp,
} from 'react-icons/io5';
import {RiExternalLinkLine} from 'react-icons/ri';
import {CgArrowsExpandRight} from 'react-icons/cg';
import * as sanitize from 'sanitize-html';

import {SIGNATURE_COLOR} from '../../../Colors';

import GoogleAnalytics from '../../../state/GoogleAnalytics';

import {StoreContext} from '../../../store';
import {parseWhen} from './When';
import {getDescriptions} from '../../../store';
import {getPreviewImage, getTypes} from './Utils';
import useSearch from '../../../state/search/useSearch';

import FullscreenImage from './FullscreenImage';
import {Dot} from 'react-animated-dots';
import {v4 as uuidv4} from 'uuid';

const highlight = (text, query) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts
        .map((part, idx) =>
            part.toLowerCase() === query.toLowerCase()
                ? `<mark>${part}</mark>`
                : part
        )
        .join('');
};

const ItemCard = React.forwardRef((props, ref) => {
    const el = useRef();

    const {search} = useSearch();

    const {store} = useContext(StoreContext);

    const [showLightbox, setShowLightbox] = useState(false);

    const proposing = props.proposing;

    const {node} = props;

    useEffect(() => {
        if (el.current) {
            el.current.querySelector('header button').blur();
        }
    }, [el.current]);

    const image = getPreviewImage(node);

    const descriptions = getDescriptions(node);

    const sourceUrl = node.properties?.url || node?.identifier || node.id;

    const when = parseWhen(node.properties?.when || node.when);

    const connectedNodes = store.getConnectedNodes(node.id);

    const blockList = props.config.link_icons
        ?.filter((p) => !p.img)
        .map((p) => p.pattern);

    const externalLinks = blockList
        ? store.getExternalLinks(node.id).filter((l) => {
              const id = l.identifier || l.id;
              return !blockList.find((pattern) => id.includes(pattern));
          })
        : store.getExternalLinks(node.id);

    // Related items includes external + internal links!
    const connected = [...connectedNodes, ...externalLinks];

    const goTo = () =>
        props.onGoTo({
            referrer: props,
            nodeList: connected,
        });

    const tagNav = () => GoogleAnalytics.tagNavigation(sourceUrl);

    // Temporary hack!
    const color = SIGNATURE_COLOR[3];

    function glyphs(glyphs) {
        if (typeof glyphs == 'undefined') return '';
        var output = [];
        glyphs.forEach(function (glyph) {
            if (!['market', 'direction'].includes(glyph))
                output.push(
                    <img src={'./glyphs/' + glyph + '.png'} title={glyph} />
                );
        });
        return output.reduce(
            (previousValue, currentValue) =>
                previousValue === null ? (
                    currentValue
                ) : (
                    <>
                        {previousValue}
                        {currentValue}
                    </>
                ),
            null
        );
    }
    function datespan(timespans) {
        var years = [timespans[0].start.latest];
        if (timespans[0].start.latest !== timespans[0].end.earliest)
            years.push(timespans[0].end.earliest);
        return years.sort().join('-');
    }
    function pageref() {
        var refs = node.id.split('-').slice(1);
        return (
            'p.' +
            parseInt(refs.shift(), 10) +
            ' #' +
            parseInt(refs.shift(), 10)
        );
    }
    function placenames() {
        if (proposing) {
            return (
                <>
                    <span>{node.names[0].toponym} (1680)</span>
                    <br />
                    <span className="proposal">
                        {props.loading && (
                            <i>
                                Fetching Wikidata<Dot>.</Dot>
                                <Dot>.</Dot>
                                <Dot>.</Dot>
                            </i>
                        )}
                        {props.error && <i>No Wikidata settlement found.</i>}
                        {props.data && (
                            <a href={props.data.place.value} target="_blank">
                                {props.data.placeLabel.value} (2022)
                            </a>
                        )}
                    </span>
                </>
            );
        } else
            return node.names
                .map((name, index) => (
                    <span
                        key={index}
                        className={
                            JSON.stringify(name.when.timespans).includes('2022')
                                ? 'proposal'
                                : ''
                        }
                    >
                        {name.toponym} ({datespan(name.when.timespans)})
                    </span>
                ))
                .reduce(
                    (previousValue, currentValue) =>
                        previousValue === null ? (
                            currentValue
                        ) : (
                            <>
                                {previousValue}
                                <br />
                                {currentValue}
                            </>
                        ),
                    null
                );
    }
	function proposals() {
		if (props.nodeKVdb) {
			const proposals = [];
			props.nodeKVdb.forEach((proposal,i) => {
				proposal = JSON.parse(proposal[1]);
				var labels = [];
				if (proposal.altTitle !== '') labels.push(<span title="Contributor's suggestion.">{proposal.altTitle}</span>);
				if (proposal.Wikidata.label !== null) labels.push(<i title="Wikidata location-based match.">{proposal.Wikidata.label}</i>);
				labels = labels.reduce(
                    (previousValue, currentValue) =>
                        previousValue === null ? (
                            currentValue
                        ) : (
                            <>
                                {previousValue}
                                <br />
                                {currentValue}
                            </>
                        ),
                    null
                );
				proposals.push(
					<tr className="proposals" key={i} title={proposal.notes+' [Contributor in '+proposal.contributor.location.city+' ('+proposal.contributor.location.country+')]'}>
	                    <td>
	                        {i+1}
	                    </td>
	                    <td colSpan="3">
	                        {labels}
	                    </td>
	                    <td>
	                        {proposal.coordinates[1].toFixed(4)}
	                    </td>
	                    <td>
	                        {proposal.coordinates[0].toFixed(4)}
	                    </td>
	                </tr>
				)
			})
			return (
				<>{proposals}</>
			)
		}
	}

    function propose() {
        ref.current.classList.toggle('proposing');
    }

    const submitKVdb = async () => {
        let notes = document.getElementById('explanation').value;
        if (notes == '') {
            alert('Please add a note explaining your proposal.');
        } else {
			let counter = props.nodeKVdb ? props.nodeKVdb.length.toString().padStart(5, '0') : '00000';
            let res = await props.bucket.set(
                props.node.id + ':' + counter + '-' + uuidv4(),
                JSON.stringify({
                    coordinates: props.proposing.coordinates,
                    Wikidata: {
                        label: props.data ? props.data.placeLabel.value : null,
                        id: props.data
                            ? props.data.place.value.split('/').pop()
                            : null,
                    },
                    notes: notes,
					altTitle: document.getElementById('newToponym').value,
                    contributor: props.ipapi
                        ? {
                              ip: props.ipapi.ip,
                              location: {
                                  city: props.ipapi.city,
                                  country:
                                      props.ipapi.country_name,
                                  coordinates: [
                                      +props.ipapi.longitude,
                                      +props.ipapi.latitude,
                                  ],
                              },
                          }
                        : null,
                })
            );

            if (res.ok) {
				props.fetchKVdb();
                alert('Thank you, your suggestion has been logged.\n\nThis page will be reloaded to refresh the markers.');
                props.setProposing(false);
                window.location.reload();
            } else {
                alert('Sorry, we had a problem logging your suggestion.');
                console.log('KVdb storage problem.', res);
            }
        }
    };

    return (
        <div ref={el} className="p6o-selection-card p6o-selection-itemcard">
            <header
                aria-disabled
                style={{
                    backgroundColor: color,
                    justifyContent: props.backButton
                        ? 'space-between'
                        : 'flex-end',
                }}
            >
                {props.backButton && (
                    <button aria-label="Go Back" onClick={props.onGoBack}>
                        <IoArrowBackOutline />
                    </button>
                )}

                <span className="IVHeader">
                    Index Villaris (1680) {pageref()}
                </span>

                <button aria-label="Close" onClick={props.onClose}>
                    <IoCloseSharp />
                </button>
            </header>
            <div
                className="p6o-selection-content"
                style={{maxHeight: `${window.innerHeight - 46}px`}}
            >
                <table className="IVEntry">
                    <thead>
                        <tr>
                            <th>Symbols</th>
                            <th>Place</th>
                            <th>County</th>
                            <th>Hundred &c.</th>
                            <th>Latit.</th>
                            <th>Longit.</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{glyphs(node.properties.glyphs)}</td>
                            <td>{decodeURIComponent(node.properties.title)}</td>
                            <td>
                                {node.properties.county}
                            </td>
                            <td>
                                {node.properties.hundred.split(' (').shift()}
                            </td>
                            <td>
                                {
                                    node.geometry.geometries.slice(-1)[0]
                                        .coordinates[1]
                                }
                            </td>
                            <td>
                                {
                                    node.geometry.geometries.slice(-1)[0]
                                        .coordinates[0]
                                }
                            </td>
                        </tr>
                        <tr className={proposing ? 'proposal' : ''}>
                            <td colSpan="4">
                                <button
                                    title="Suggest different location."
                                    aria-label="Move"
                                    onClick={propose}
                                >
                                    <IoPinSharp />
                                </button>
                                {placenames()}
                            </td>
                            <td>
                                {proposing
                                    ? proposing.coordinates[1].toFixed(4)
                                    : node.geometry.geometries[0].coordinates[1].toFixed(
                                          4
                                      )}
                            </td>
                            <td>
                                {proposing
                                    ? proposing.coordinates[0].toFixed(4)
                                    : node.geometry.geometries[0].coordinates[0].toFixed(
                                          4
                                      )}
                            </td>
                        </tr>
                        {proposals()}
                        {proposing && (props.data || props.error) && (
                            <tr className="proposal submission">
                                <td colSpan="6">
                                    <textarea
                                        id="explanation"
                                        placeholder="Please write a note explaining your suggestion, perhaps including relevant sources or URLs of web sites."
                                    ></textarea>
                                    <input id="newToponym" placeholder="Alternative place-name (optional)."/>
									<button
                                        title="Submit suggestion."
                                        aria-label="Submit"
                                        onClick={submitKVdb}
                                    >
                                        <IoSaveSharp />
                                    </button>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showLightbox && (
                <FullscreenImage
                    image={image}
                    onClose={() => setShowLightbox(false)}
                />
            )}
        </div>
    );
});

export default ItemCard;
