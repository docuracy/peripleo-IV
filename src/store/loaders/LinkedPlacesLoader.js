import Store, { normalizeURI, getBounds } from '..';

import { getEmbeddedLinkedNodes } from './LinkedPlacesExtended';

/**
 * Converts a GeoJSON/LP feature into a store graph node.
 * 
 * The graph node is mostly identical to the GeoJSON feature,
 * with just a few sytactic normalizations.
 * 
 * @param {object} feature the GeoJSON feature 
 * @param {string} name the dataset name 
 * @returns {object} the graph node
 */
const featureToNode = (feature, name) => {
  const node = { ...feature };

  // LP uses '@id', whereas graph nodes use 'id'
  const id = normalizeURI(feature['@id']);
  delete node['@id'];
  node.id = id;
  node.title = node.properties.title;
  node.dataset = name;

  // For convenience when mapping
  node.properties.id = id;
  node.properties.dataset = name;
  
  // Handle LP geometry.geometries and inadequate facet filtering
	var geometries = [...node.geometry.geometries];
	node.geometry = {...node.geometry.geometries[0]};
	node.geometry.geometries = [...geometries];
	node.properties.county = decodeURIComponent(node.relations[0].relationTo.split(':').pop());
	node.properties.hundred = decodeURIComponent(node.relations[1].relationTo.split(':').pop().replace('_',' (')+')');
        
  return node;
}

/**
 * Fetches a Linked Places dataset from a URL and loads it into the graph store.
 * @param {string} url the dataset URL
 * @param {string} name the dataset name  
 * @param {Store} store the graph store
 */
export const loadLinkedPlaces = (name, url, store) => 
  fetch(url)    
    .then(response => response.json())
    .then(data => {
    	
      /*
      if (window.location.pathname.split("/")[0] === 'peripleo-IV' || location.hostname === 'localhost' ) {
			// Filter the features based on certainty
        	data.features = data.features.filter(feature => {
				const certainty = feature.geometry.geometries[0]?.certainty;
				return certainty !== 'certain';
			});
	  }
      */
	 
      console.log(`Importing LP: ${name} (${data.features.length} features)`);
      
      const timestamp = new Date().getTime();
	  const kvdbUrl = 'https://kvdb.io/EWuFG2nmhkN78fQoKHUKCp/?values=true&format=json&timestamp=' + timestamp; // Timestamp forces refresh
	  return fetch(kvdbUrl)
        .then(response => response.json())
        .then(jsonData => {
      	  const identifiers = jsonData.map(subarray => subarray[0].split(':').slice(0, 2).join(':'));
      	  
	      store.graph.beginUpdate();
	
	      // Add nodes to graph and spatial tree
	      const nodes = data.features.map(feature => {
	        // This feature, as a node
	        const node = featureToNode(feature, name);
	        node.suggestions = identifiers.filter(id => id === feature['@id']).length.toString();
	        
	        store.graph.addNode(node.id, node);
	
	        const bounds = getBounds(node);
	        if (bounds)
	            store.spatialIndex.insert({ ...bounds, node });  
	
	        return node;
	      });
	    
	      // Add edges to graph
	      const edgeCount = nodes
	        .filter(node => node.links?.length > 0)
	        .reduce((totalCount, node) => { 
	          return totalCount + node.links.reduce((countPerNode, link) => {
	            try {
	              const identifier = link.identifier || link.id; // required
	
	              if (identifier) {
	                // In LinkedPlaces, links have the shape
	                // { type, id }
	                const sourceId = node.id;
	                const targetId = normalizeURI(link.id || link.identifier);
	
	                // Normalize in place
	                link.id = targetId;
	
	                // Note that this will create 'empty nodes' for targets not yet in
	                store.graph.addLink(sourceId, targetId, link);
	
	                return countPerNode + 1;
	              } else {
	                console.warn('Link does not declare identifier', link, 'on node', node);
	                return countPerNode;
	              }
	            } catch {
	              console.error('Unable to parse link', link, 'on node', node);
	              return countPerNode;
	            }
	          }, 0)
	        }, 0);
	
	      store.graph.endUpdate();
	      
	      console.log(location.hostname, location.pathname.split("/"));
    	
	      if (location.pathname.split("/")[1] === 'peripleo-IV' || location.hostname === 'localhost' ) {
			  console.log('Indexing disabled on peripleo-IV and localhost.');
		  }
		  else{
	
		      // Add to search index
		      console.log('Indexing...');
		      console.time('Took');
		      store.index([...nodes]);
		      console.timeEnd('Took');
				  
		  }
	
	      return { 
	        // Dataset name,
	        name,
	
	        // Dataset node count
	        nodes: nodes.length, 
	
	        // Dataset edge count
	        edges: edgeCount,
	
	        // Dataset structured metadata, if any
	        metadata: data.indexing
	      };
	    });
	});

