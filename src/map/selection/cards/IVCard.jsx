import React, {useContext, useEffect, useRef, useState} from 'react';
import {BiLink} from 'react-icons/bi';
import {IoArrowBackOutline, IoCloseSharp, IoPinSharp} from 'react-icons/io5';
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

const ItemCard = (props) => {
	const el = useRef();

	const {search} = useSearch();

	const {store} = useContext(StoreContext);

	const [showLightbox, setShowLightbox] = useState(false);

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
		if (timespans[0].start.latest !== timespans[1].end.earliest)
			years.push(timespans[1].end.earliest);
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

				<button
					aria-label="Close"
					onClick={props.onClose}
				>
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
							<td>{node.properties.title}</td>
							<td>{node.properties.county}</td>
							<td>
								{decodeURIComponent(
									node.properties.hundred.split(' (').shift()
								)}
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
						<tr>
							<td colSpan="4">
								<button
									title="Suggest different location."
									aria-label="Move"
									onClick={props.onClose}
								>
									<IoPinSharp />
								</button>
								{node.names
									.map((name, index) => (
										<span key={index}>
											{name.toponym} (
											{datespan(name.when.timespans)})
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
									)}
							</td>
							<td>
								{node.geometry.geometries[0].coordinates[1].toFixed(
									4
								)}
							</td>
							<td>
								{node.geometry.geometries[0].coordinates[0].toFixed(
									4
								)}
							</td>
						</tr>
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
};

export default ItemCard;
