

L.VectorGrid = L.GridLayer.extend({

	options: {
		rendererFactory: L.svg.tile,
		vectorTileLayerStyles: {},
		interactive: false,
	},

	createTile: function(coords, done) {
		var tileSize = this.getTileSize();
		var renderer = this.options.rendererFactory(this._map, coords, tileSize, this.options);

		var vectorTilePromise = this._getVectorTilePromise(coords);


		vectorTilePromise.then( function renderTile(vectorTile) {

			for (var layerName in vectorTile.layers) {
				var layer = vectorTile.layers[layerName];

				/// NOTE: THIS ASSUMES SQUARE TILES!!!!!1!
				var pxPerExtent = this.getTileSize().x / layer.extent;

				var layerStyle = this.options.vectorTileLayerStyles[ layerName ] ||
				L.Path.prototype.options;

				for (var i in layer.features) {
					var feat = layer.features[i];

					/// Style can be a callback that is passed the feature's
					/// properties and tile zoom level...
					var styleOptions = (layerStyle instanceof Function) ?
					layerStyle(feat.properties, coords.z) :
					layerStyle;

					this._mkFeatureParts(feat, pxPerExtent);

					if (!(styleOptions instanceof Array)) {
						styleOptions = [styleOptions];
					}

					/// Style can be an array of styles, for styling a feature
					/// more than once...
					for (var j in styleOptions) {
						var style = L.extend({}, L.Path.prototype.options, styleOptions[j]);

						if (feat.type === 2) {	// Polyline
							style.fill = false;
						}

						if (this.options.interactive) {
							this._makeInteractive(feat);
						}

						feat.options = style;
						renderer._initPath( feat );
						renderer._updateStyle( feat );

						if (feat.type === 1) { // Points
							feat._radius = style.radius,
							renderer._updateCircle( feat );
						} else if (feat.type === 2) {	// Polyline
							renderer._updatePoly(feat, false);
						} else if (feat.type === 3) {	// Polygon
							renderer._updatePoly(feat, true);
						}

						renderer._addPath( feat );
					}
				}

			}
			L.Util.requestAnimFrame(done.bind(coords, null, null));
		}.bind(this));

		return renderer.getContainer();
	},



	// Fills up feat._parts based on the geometry and pxPerExtent,
	// pretty much as L.Polyline._projectLatLngs and L.Polyline._clipPoints
	// would do but simplified as the vectors are already simplified/clipped.
	_mkFeatureParts: function(feat, pxPerExtent) {
		var coord;

		if (feat.type === 1) {
			// Point
			coord = feat.geometry[0][0];
			if ('x' in coord) {
				feat._point = L.point(coord.x * pxPerExtent, coord.y * pxPerExtent);
				feat._empty = L.Util.falseFn;
			}
		} else {
			// Polylines and polygons
			var rings = feat.geometry;

			feat._parts = [];
			for (var i in rings) {
				var ring = rings[i];
				var part = [];
				for (var j in ring) {
					coord = ring[j];
					if ('x' in coord) {
						// Protobuf vector tiles return {x: , y:}
						part.push(L.point(coord.x * pxPerExtent, coord.y * pxPerExtent));
					} else {
						// Geojson-vt returns [,]
						part.push(L.point(coord[0] * pxPerExtent, coord[1] * pxPerExtent));
					}
				}
				feat._parts.push(part);
			}
		}
	},

	_makeInteractive: function(feat) {
		feat._clickTolerance = L.Path.prototype._clickTolerance;
		L.extend(feat, L.Evented.prototype);
		feat.addEventParent(this);

		switch (feat.type) {
		case 1: // Point
			feat._containsPoint = L.CircleMarker.prototype._containsPoint;
			var r = this._radius,
			    r2 = this._radiusY || r,
			    w = this._clickTolerance(),
			    p = [r + w, r2 + w];
			this._pxBounds = new L.Bounds(this._point.subtract(p), this._point.add(p));
			break;
		case 2: // Polyline
			feat._containsPoint = L.Polyline.prototype._containsPoint;
			feat._pxBounds = this._getPixelBounds(feat._parts);
			break;
		case 3: // Polygon
			feat._containsPoint = L.Polygon.prototype._containsPoint;
			feat._pxBounds = this._getPixelBounds(feat._parts);
			break;
		}
	},

	_getPixelBounds: function(parts) {
		var bounds = L.bounds([]);
		for (var i = 0; i < parts.length; i++) {
			var part = parts[i];
			for (var j = 0; j < part.length; j++) {
				bounds.extend(part[j]);
			}
		}

		return bounds;
	}
});



L.vectorGrid = function (options) {
	return new L.VectorGrid(options);
};



