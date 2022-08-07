import React, {
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from 'react';
import ReactMapGL, {AttributionControl, Marker} from 'react-map-gl';
import {useRecoilState, useRecoilValue} from 'recoil';
import {AnimatePresence} from 'framer-motion';

import useSearch from '../state/search/useSearch';
import {StoreContext} from '../store';
import {selectedState, mapViewState, mapModeState, deviceState} from '../state';

import {parseLayerConfig} from './BaseLayers';
import LayersCategorized from './LayersCategorized';
import LayersUncategorized from './LayersUncategorized';

import Controls from './controls/Controls';
import HoverBubble from './HoverBubble';
import SelectionPreview from './selection/SelectionPreview';
import MyLocation from './MyLocation';

import Hoop from './styles/Hoop';

import KVdb from '../KVdb';

const bucket = KVdb.bucket('EWuFG2nmhkN78fQoKHUKCp','7syYw4k7C6VDV6f');

const Map = React.forwardRef((props, ref) => {
	
	const {config} = props;

	const mapRef = useRef();

	const {store} = useContext(StoreContext);

	const {search} = useSearch();

	const [viewstate, setViewstate] = useRecoilState(mapViewState);

	const modeState = useRecoilValue(mapModeState);

	const device = useRecoilValue(deviceState);

	const [hover, setHover] = useState();

	const [selectedId, setSelectedId] = useRecoilState(selectedState);

	const [selection, setSelection] = useState();

	const [lastSelection, setLastSelection] = useState();

	const [proposing, setProposing] = useState(false);

    const [nodeKVdb, setNodeKVdb] = useState(false);

	const KVdbMarkers = () => {
		if (nodeKVdb) {
			const proposals = [];
			nodeKVdb.forEach((proposal,i) => {
				proposal = JSON.parse(proposal[1]);
				proposals.push(
					<Marker
				      key={i}
					  longitude={proposal.coordinates[0]}
				      latitude={proposal.coordinates[1]}>
				      <div className="KVdbMarker">
				        <span><b>{i + 1}</b></span>
				      </div>
				    </Marker>
				)
			})
			return (
				<>{proposals}</>
			)
		}
	};

	const fetchKVdb = async () => {
		console.log('fetchKVdb',selectedId);
		if(typeof selectedId === 'string' && selectedId.startsWith('IV:IV1680-')){
			let res = await bucket.list({prefix: selectedId, values: true});
			setNodeKVdb(res);
		}
    };

	const customAttribution = config.data.reduce(
		(attr, dataset) =>
			dataset.attribution ? [...attr, dataset.attribution] : attr,
		[]
	);
	
	// Wikidata Settlements API
	const [data, setData] = useState(null);
 	const [loading, setLoading] = useState(true);
 	const [error, setError] = useState(null);
	const findStartingCode=e=>e[0].toUpperCase();
	const findLetterCode=e=>{switch(e.toUpperCase()){case"B":case"F":case"P":case"V":return"1";case"C":case"G":case"J":case"K":case"Q":case"S":case"X":case"Z":return"2";case"D":case"T":return"3";case"L":return"4";case"M":case"N":return"5";case"R":return"6";default:return null}};
	const soundex=e=>{if(e){let t=findStartingCode(e),r=findLetterCode(t);for(let a=1;a<e.length;++a){const n=findLetterCode(e[a]);if(n&&n!=r&&4==(t+=n).length)break;r=n}for(let e=t.length;e<4;++e)t+="0";return t}return null};

	// ipapi data
	const [ipapi, setipapi] = useState(false);
	if (!ipapi) fetch('https://ipapi.co/json/')
	  .then((response) => {
	    return response.json();
	  })
	  .then((actualData) => {
		setipapi(actualData);
	  })
	  .catch((err) => {
	    console.log('Error fetching ipapi data.',err);
		setipapi(false);
	  });

	useEffect(() => {
		const fitMap = search?.fitMap;
		if (fitMap && mapRef.current) {
			setSelection(null);
			setSelectedId(null);

			const bounds = search.bounds();
			if (bounds)
				mapRef.current.fitBounds(bounds, {padding: 40, maxZoom: 14});
		}
	}, [search]);

	// Sync selection state downwards
	useEffect(() => {
		const currentSelectionId = selection?.nodeList
			? selection.nodeList[0].id
			: selection?.node.id;

		if (selectedId && currentSelectionId !== selectedId) {
			const node = store.getNode(selectedId);
			if (node) {
				setSelection({node});
				setLastSelection({node});
			}
		} else if (!selectedId && selection) {
			setSelection(null);
		}
		
	}, [selectedId, search]);
	
	useEffect(() => {
		fetchKVdb();
	}, [selectedId]);

	useEffect(() => {
		// Map container gets hover element,
		// so we can toggle cursor
		if (hover) ref.current.classList.add('hover');
		else ref.current.classList.remove('hover');
	}, [hover]);

	const onMapChange = useCallback((evt) => {
		setViewstate(evt.viewState);
	}, []);

	const onMouseMove = useCallback((evt) => {
		const {point} = evt;

		const features = mapRef.current
			.queryRenderedFeatures(evt.point)
			.filter((f) => f.layer.id.startsWith('p6o'));

		if (features.length > 0) {
			const {id} = features[0].properties;

			const updated =
				id === hover?.id
					? {
							...hover,
							...point,
					  }
					: {
							node: store.getNode(id),
							feature: features[0],
							...point,
					  };

			setHover(updated);
		} else {
			setHover(null);
		}
	}, []);

	const onClick = (clickPoint) => {
		setData(null);
		setLoading(true);
		setError(null);
		if (hover) {
			setHover(null);

			const {node, feature} = hover;
			const colocated = feature.properties.colocated_records || 0;

			if (colocated) {
				const neighbours = store.getNearestNeighbours(node, colocated);
				setSelection({nodeList: [node, ...neighbours], feature});
			} else {
				setSelection({node, feature});
			}

			// Sync state up
			setSelectedId(node.id);
			setLastSelection({node, feature});
			setProposing(false);
			setNodeKVdb(false);
		} 
		else if (ref.current.classList.contains('proposing')) {
			setProposing(clickPoint.lngLat);
			setSelection(lastSelection);
			var sparql = 'SELECT DISTINCT ?place ?placeLabel ?geo ?distance WHERE { ?place wdt:P31/wdt:P279* wd:Q486972 . SERVICE wikibase:around { ?place wdt:P625 ?geo . bd:serviceParam wikibase:center "Point(%%%lng%%% %%%lat%%%)"^^geo:wktLiteral . bd:serviceParam wikibase:radius "%%%radius%%%" . bd:serviceParam wikibase:distance ?distance }  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }} Order by  ?distance';
			fetch('https://query.wikidata.org/sparql?query='+encodeURIComponent(sparql.replace('%%%lng%%%',clickPoint.lngLat.lng).replace('%%%lat%%%',clickPoint.lngLat.lat).replace('%%%radius%%%',3)),{
				method: 'GET',
				headers: { 
					'Accept': 'application/sparql-results+json'
				}
			  })
		      .then((response) => {
		        return response.json();
		      })
		      .then((actualData) => {
				if (actualData.results.bindings.length == 0) {
					setError(true);
					return;
				}
				const soundexMatch = actualData.results.bindings.find(binding => soundex(binding.placeLabel.value) == soundex(selection.node.properties.title));
				setData(typeof soundexMatch !== 'undefined' ? soundexMatch : actualData.results.bindings[0]);
		        setError(null);
		      })
		      .catch((err) => {
		        setError(err.message);
		        setData(null);
		      })
		      .finally(() => {
		        setLoading(false);
		      });
		}
		else {
			setSelection(null);
			setProposing(false);
			setNodeKVdb(false);

			// Sync state up
			setSelectedId(null);
		}
		ref.current.classList.remove('proposing');
	};

	const onZoom = (inc) => () => {
		const map = mapRef.current;
		const z = mapRef.current.getZoom();
		map.easeTo({zoom: z + inc});
	};

	const onClosePopup = () => {
		setSelection(null);
		setSelectedId(null);
		ref.current.classList.remove('proposing');
		setProposing(false);
		setNodeKVdb(false);
	};

	const moveIntoView = (coord, bounds) => {
		const PADDING = 30;

		const map = mapRef.current;
		const {width, height} = map.getCanvas();
		const point = map.project(coord);

		let dx, dy;

		if (bounds.top < 0) {
			dy = point.y - bounds.height - PADDING;
		} else if (height - bounds.top - bounds.height < 0) {
			dy = point.y + bounds.height - height + PADDING;
		} else {
			dy = 0;
		}

		if (bounds.left < 0) {
			dx = bounds.width - point.x + PADDING;
		} else if (width - bounds.left - bounds.width < 0) {
			dx = width - point.x - bounds.width - PADDING;
		} else {
			dx = 0;
		}

		map.panBy([dx, dy]);
	};

	const panTo = (lat, lon) =>
		mapRef.current.flyTo({center: [lon, lat], zoom: 14});

	return (
		<div
			ref={ref}
			className={
				device === 'MOBILE'
					? 'p6o-map-container mobile'
					: 'p6o-map-container'
			}
		>
			<ReactMapGL
				attributionControl={false}
				pitchWithRotate={false}
				dragRotate={false}
				clickTolerance={device === 'MOBILE' ? 10 : 3}
				ref={mapRef}
				initialViewState={
					viewstate.latitude && viewstate.longitude && viewstate.zoom
						? viewstate
						: {
								bounds: config.initial_bounds,
						  }
				}
				mapStyle={config.map_style}
				onLoad={props.onLoad}
				onMove={onMapChange}
				onClick={onClick}
				onMouseMove={onMouseMove}
			>
				{props.config.layers &&
					props.config.layers.map((layer) => parseLayerConfig(layer))}

				{search.facetDistribution ? (
					<LayersCategorized
						selectedMode={modeState}
						search={search}
					/>
				) : (
					<LayersUncategorized
						selectedMode={modeState}
						search={search}
					/>
				)}

				<AnimatePresence>
					{ selection && (
						<SelectionPreview
							{...selection}
							ref={ref}
							proposing={proposing ? {'coordinates':[+proposing.lng,+proposing.lat]} : false}
							setProposing={setProposing}
							nodeKVdb={nodeKVdb}
		  					fetchKVdb={fetchKVdb}
							bucket={bucket}
							data={data}
							loading={loading}
							error={error}
							config={props.config}
							moveIntoView={moveIntoView}
							onClose={onClosePopup}
							ipapi={ipapi}
						/>
					)}
				</AnimatePresence>

				{customAttribution.length > 0 && (
					<AttributionControl
						compact
						customAttribution={customAttribution}
					/>
				)}
				
				{nodeKVdb && (
					KVdbMarkers()
				)}
				
				{proposing && (
					<Marker
						longitude={proposing.lng}
						latitude={proposing.lat}
					>
					<Hoop size={40} />
					</Marker>
				)}
				
			</ReactMapGL>

			<Controls
				fullscreenButton={props.isIFrame}
				isFullscreen={props.isFullscreen}
				onZoomIn={onZoom(1)}
				onZoomOut={onZoom(-1)}
				onToggleFullscreen={props.onToggleFullscreen}
			/>

			{!config.disableMyLocation && <MyLocation onPanTo={panTo} />}

			{props.children}

			{hover && <HoverBubble {...hover} />}
		</div>
	);
});

export default Map;
