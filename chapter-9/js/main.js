(function () {
    //variables for data join
    var attrArray = ["total_population_20", "incarcerated_20", "total_population_10", "incarcerated_10", "total_population_00", "incarcerated_20", "historical_90", "slow_90", "noaction_90", "rapid_90", "historical_100", "slow_100", "noaction_100", "rapid_100", "historical_105", "slow_105", "noaction_105", "rapid_105", "historical_127", "slow_127", "noaction_127", "rapid_127"];
    var year = [90, 100, 105, 127];
    var heatIndexArray = ["historical_" + year, "slow_" + year, "noaction_" + year, "rapid_" + year];
    var expressed1 = attrArray[6]

    //create global scale
    var scaleY = d3.scaleLinear()
        .range([400, 50])
        .domain([200, 0]);

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
            .scale(1250)
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

            //create dropdown
            createDropdown(csvData);

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
                redrawCircle(d.properties, ".incarceratedCircle")
                drawHeatIndex(this.Value, d.properties, ".linePlot1", 75, "heatIndexClick", colorScale)
            })
            .on("mouseover", function (event, d) {
                redrawCircle(d.properties, ".incarceratedHoverCircle");
                drawHeatIndex(this.Value, d.properties, ".linePlot2", 575, "heatIndexHover", colorScale)
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

        var linePlot1 = d3.select(".chart")
            .append("svg")
            .attr("height", 200)
            .attr("width", 500)
            .attr("transform", "translate(70, 105)")
            .attr("class", "linePlot1");

        var linePlot2 = d3.select(".chart")
            .append("svg")
            .attr("height", 200)
            .attr("width", 500)
            .attr("transform", "translate(570, 105)")
            .attr("class", "linePlot2");

        //create axis

        var xAxis = d3.axisBottom(scaleY);

        //create axis g element and add axis
        var axis1 = linePlot1.append("g")
            .attr("class", "axis1")
            .attr("transform", "translate(75, 100)")
            .call(xAxis);

        var axis2 = linePlot2.append("g")
            .attr("class", "axis2")
            .attr("transform", "translate(575, 100)")
            .call(xAxis);

        var chartTitle = chart.append("text")
            .attr("x", 115)
            .attr("y", 20)
            .attr("class", "chartTitle")
            .text("Number of Incarcerated People " + "Projected Number of Days Above a Heat Index of " + year + " Degrees, By County")

        drawCircle();
        //drawHeatIndex()

    }

    function drawCircle() {
        var circle = d3.select(".chart")
            .append("circle")
            .datum(15000)
            .attr("class", "incarceratedCircle")
            .attr("r", function (d) {
                //calculate the radius based on population value as circle area
                console.log(d);
                var area = d * 0.4;
                return Math.sqrt(area / Math.PI);
            })
            .attr("cx", function (d, i) {
                return 70;
            })
            .attr("cy", function (d) {
                return 80;
            });

        var circle = d3.select(".chart")
            .append("circle")
            .datum(15000)
            .attr("class", "incarceratedHoverCircle")
            .attr("r", function (d) {
                //calculate the radius based on population value as circle area
                console.log(d);
                var area = d * 0.4;
                return Math.sqrt(area / Math.PI);
            })
            .attr("cx", function (d, i) {
                return 550;
            })
            .attr("cy", function (d) {
                return 80;
            });
    }

    function redrawCircle(data, type) {
        var circle = d3.select(type)
            .datum(data)
            .attr("id", function (d) {
                return "incarceratedCircle " + d.GEOID;
            })
            .attr("r", function (d) {
                var area = d["incarcerated_20"] * 0.4;
                return Math.sqrt(area / Math.PI);
            })

        var numbers = d3.select(type).select(".numbers")
            .datum(data)
            .append("text")
            .attr("class", function (d) {
                return "numbers " + d.GEOID
            })
            .attr("text-anchor", "middle")
            .attr("x", function (d) {
                if (type == "incarceratedCircle") {
                    return 70
                }
                else {
                    return 550
                }
            })

            .attr("y", function (d) {
                return 100;
            })
            .text(function (d) {
                return d["incarcerated_20"];
            });

    }

    function createDropdown(csvData) {
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function () {
                changeAttribute(this.value, csvData)
                changeHeatIndex(this.value, csvData, ".linePlot1", "heatIndexClick")
                changeHeatIndex(this.value, csvData, ".linePlot2", "heatIndexHover")
            });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");

        //add attribute name options
        var attrOptions = dropdown
            .selectAll("attrOptions")
            .data(year)
            .enter()
            .append("option")
            .attr("value", function (d) {
                return d
            })
            .text(function (d) {
                return d + " degrees"
            });
    }

    //dropdown change event handler
    function changeAttribute(attribute, csvData) {
        //change the expressed attribute
        expressed1 = "historical_" + attribute;

        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        //recolor enumeration units
        var counties = d3.selectAll(".counties")
            .style("fill", function (d) {
                var value = d.properties[expressed1];
                if (value) {
                    return colorScale(d.properties[expressed1]);
                } else {
                    return "#ccc";
                }
            });
    }

    function drawHeatIndex(attribute, data, type, transform, label, colorScale) {
        d3.select(type).selectAll("circle").remove();
        expressed1 = "historical_" + attribute
        year = 90
        var circle = d3.select(type)
            .selectAll("." + label)
            .data(["historical_" + year, "slow_" + year, "noaction_" + year, "rapid_" + year])
            .enter()
            .append("circle")
            .attr("class", label)
            .attr("id", function (d) {
                return d
            })
            .attr("r", 10)
            .attr("cx", function (d, i) {
                return scaleY(data[d]);
            })
            .attr("cy", function (d) {
                return 80;
            })
            .attr("transform", "translate(" + transform + ")")
            .style("fill", function (d) {
                var value = data[d];
                if (value) {
                    return colorScale(data[d]);
                } else {
                    return "#ccc";
                }
            });
    }


    function changeHeatIndex(attribute, csvData, type, label) {
        //change expressed attribute
        expressed1 = "historical_" + attribute;
        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        //recolor enumeration units
        var circle = d3.selectAll(type)
            .selectall("." + label)
            .style("fill", function (d) {
                var value = d.properties[expressed1];
                if (value) {
                    return colorScale(d.properties[expressed1]);
                } else {
                    return "#ccc";
                }
            })
    }



})();
