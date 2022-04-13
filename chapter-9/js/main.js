(function () {
    //variables for data join
    var attrArray = ["total_population_20", "incarcerated_20", "total_population_10", "incarcerated_10", "total_population_00", "incarcerated_20", "historical_90", "slow_90", "noaction_90", "rapid_90", "historical_100", "slow_100", "noaction_100", "rapid_100", "historical_105", "slow_105", "noaction_105", "rapid_105", "historical_127", "slow_127", "noaction_127", "rapid_127"];
    var expressed1 = attrArray[8]
    //var expressed = attrArray[1]; //initial attribute
    //var divider = attrArray[0];

    //begin script when window loads
    window.onload = setMap();

    //set up choropleth map
    function setMap() {

        //map frame dimensions
        var width = window.innerWidth * 0.98,
            height = window.innerHeight * 0.75;

        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        //create Albers equal area conic projection centered on US
        var projection = d3.geoAlbers()
            .parallels([29.5, 45.5])
            .scale(1400)
            .translate([480, 250])
            .rotate([96, 0])
            .center([-0.6, 38.7])
            .translate([width / 2, height / 2]);

        var path = d3.geoPath()
            .projection(projection);

        //use Promise.all to parallelize asynchronous data loading
        var promises = [d3.csv("data/heat_index_and_incarceration_by_county.csv"),
        d3.json("data/us_counties.topojson"),
        ];
        Promise.all(promises).then(callback);

        function callback(data) {
            var csvData = data[0],
                countiesData = data[1];

            //place graticule on map
            setGraticule(map, path);

            //translate usCounties TopoJSON
            var usCounties = topojson.feature(countiesData, countiesData.objects.us_counties).features;

            //join csv data to GeoJSON enumeration units
            usCounties = joinData(usCounties, csvData);

            //create the color scale
            var colorScale = makeColorScale(csvData);

            //add enumeration units to the map
            setEnumerationUnits(usCounties, map, path, colorScale);

            //add coordinated visual
            setChart(csvData, colorScale);
        }
    }; //end setMap()

    function setGraticule(map, path) {
        //create graticule generator
        var graticule = d3.geoGraticule()
            .step([5, 5]); //place graticule lines every 5 degrees of longitude and latitude

        //create graticule background
        var gratBackground = map.append("path")
            .datum(graticule.outline()) //bind graticule background
            .attr("class", "gratBackground") //assign class for styling
            .attr("d", path) //project graticule

        //create graticule lines
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines()) //bind graticule lines to each element to be created
            .enter() //create an element for each datum
            .append("path") //append each element to the svg as a path element
            .attr("class", "gratLines") //assign class for styling
            .attr("d", path); //project graticule lines

    };

    function joinData(usCounties, csvData) {
        //loop through csv to assign each set of csv attribute values to geojson region
        for (var i = 0; i < csvData.length; i++) {
            var csvCounty = csvData[i]; //the current county
            var csvKey = csvCounty.FIPS; //the CSV primary key for each county (Connector with GEOID)

            //loop through geojson regions to find correct region
            for (var a = 0; a < usCounties.length; a++) {

                var geojsonProps = usCounties[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.GEOID; //the geojson primary key (connector with FIPS)

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey) {

                    //assign all attributes and values
                    attrArray.forEach(function (attr) {
                        var val = parseFloat(csvCounty[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };
        console.log(usCounties)
        return usCounties;
    };

    function makeColorScale(data) {
        var colorClasses = [
            "#ffffb2",
            "#fecc5c",
            "#fd8d3c",
            "#f03b20",
            "#bd0026",
        ];

        //create color scale generator
        var colorScale = d3.scaleQuantile()
            .range(colorClasses);

        //build two-value array of minimum and maximum expressed attribute values
        var minmax = [
            d3.min(data, function (d) { return parseFloat(d[expressed1]); }),
            d3.max(data, function (d) { return parseFloat(d[expressed1]); })
        ];
        //assign two-value array as scale domain
        colorScale.domain(minmax);

        console.log(colorScale.quantiles())
        return colorScale;
    };

    function setEnumerationUnits(usCounties, map, path, colorScale) {
        //add counties to map
        var counties = map.selectAll(".counties")
            .data(usCounties)
            .enter()
            .append("path")
            .attr("class", function (d) {
                return "counties " + d.properties.GEOID;
            })
            .attr("d", path)
            .style("fill", function (d) {
                var value = d.properties[expressed1];
                if (value) {
                    return colorScale(d.properties[expressed1]);
                } else {
                    return "#ccc";
                }
            })
            .on("click", function (event, d) {
                redrawCircle(d.properties, ".incarceratedCircle");
            })
            .on("mouseover", function (event, d) {
                redrawCircle(d.properties, ".incarceratedHoverCircle");
            })
    }

    function setChart(csvData, colorScale) {
        //chart frame dimensions
        var chartWidth = window.innerWidth * 0.98,
            chartHeight = window.innerHeight * 0.2;

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        drawCircle();
    }

    function redrawCircle (data, type) {
        var circle = d3.select(type)
        .datum(data)
        .attr("id", function (d) {
            return "incarceratedCircle " +d.GEOID;
        })
        .attr("r", function(d){
            //calculate the radius based on population value as circle area
            var area = d["incarcerated_20"] * 0.1;
            return Math.sqrt(area/Math.PI);
        })
    }

    function drawCircle () {
        var circle = d3.select(".chart")
        .append("circle")
        .datum(15000)
        .attr("class", "incarceratedCircle")
        .attr("r", function(d){
            //calculate the radius based on population value as circle area
            console.log(d);
            var area = d * 0.1;
            return Math.sqrt(area/Math.PI);
        })
        .attr("cx", function(d, i){
            //use the index to place each circle horizontally
            return 90;
        })
        .attr("cy", function(d){
            //subtract value from 450 to "grow" circles up from the bottom instead of down from the top of the SVG
            return 80;
        });

        var circle = d3.select(".chart")
        .append("circle")
        .datum(15000)
        .attr("class", "incarceratedHoverCircle")
        .attr("r", function(d){
            //calculate the radius based on population value as circle area
            console.log(d);
            var area = d * 0.1;
            return Math.sqrt(area/Math.PI);
        })
        .attr("cx", function(d, i){
            //use the index to place each circle horizontally
            return 500;
        })
        .attr("cy", function(d){
            //subtract value from 450 to "grow" circles up from the bottom instead of down from the top of the SVG
            return 80;
        });

    }

        
        // var circle = d3.select(".incarceratedCircle") //no circle yet
        // .datum(csvData)
        // .enter()
        // .append("incarceratedCircle")
        // .attr("id", function (d) {
        //     return "incarceratedCircle " + d.GEOID;
        // })
        // .attr("r", function (d, i) { //circle radius
        //     console.log("d:", d, "i:", i); //let's take a look at d and i
        //     return d;
        // })
    // }


})();
