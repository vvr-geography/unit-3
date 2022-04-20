(function () {
    //variables for data join
    var attrArray = ["total_population_20", "incarcerated_20", "total_population_10", "incarcerated_10", "total_population_00", "incarcerated_20", "historical_90", "slow_90", "noaction_90", "rapid_90", "historical_100", "slow_100", "noaction_100", "rapid_100", "historical_105", "slow_105", "noaction_105", "rapid_105", "historical_127", "slow_127", "noaction_127", "rapid_127"];
    var year = [90, 100, 105, 127];
    var selectedYear = year[0];
    var heatIndexArray = ["historical_" + year, "slow_" + year, "noaction_" + year, "rapid_" + year];
    var expressed1 = attrArray[6]

    var clickedLayer = ".d"

    //create global scale
    var scaleY = d3.scaleLinear()
        .range([400, 50])
        .domain([200, 0]);

    //begin script when window loads
    window.onload = setMap();

    //set up choropleth map
    function setMap() {

        //map frame dimensions
        var width = window.innerWidth * 0.75,
            height = window.innerHeight * 0.75;

        //create new svg container for the map
        var map = d3.select(".maphtml")
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

            // //place graticule on map
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
            setChart(csvData, colorScale, usCounties);

            //create dropdown
            createDropdown(csvData, colorScale);

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

        // //create graticule lines
        // var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        //     .data(graticule.lines()) //bind graticule lines to each element to be created
        //     .enter() //create an element for each datum
        //     .append("path") //append each element to the svg as a path element
        //     .attr("class", "gratLines") //assign class for styling
        //     .attr("d", path); //project graticule lines

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

    function highlightClick(props, colorScale, label) {
        //change stroke
        var selected = d3.selectAll(".d" + props.GEOID)
            .style("stroke", "black")
            .style("stroke-width", "2");

        clickedLayer = props.GEOID;
        createLabelLegendClick(props, colorScale, label)
    };

    //function to highlight enumeration units and bars
    function highlight(props, colorScale) {
        //change stroke
        if (clickedLayer != props.GEOID) {
            var selected = d3.selectAll(".d" + props.GEOID)
                .style("stroke", "blue")
                .style("stroke-width", "2")
        };

        setLabel(props, colorScale);
        createLabelLegend(props, colorScale)
    };

    function dehighlight() {
        //change stroke

        var counties = d3.selectAll(".counties")
            .style("stroke", "black")
            .style("stroke-width", function (d) {
                if (d.properties.GEOID != clickedLayer)
                    return ".4"
                else
                    return "2"
            });

        //remove info label
    };

    function setEnumerationUnits(usCounties, map, path, colorScale) {
        //add counties to map
        var counties = map.selectAll(".counties")
            .data(usCounties)
            .enter()
            .append("path")
            .attr("class", function (d) {
                return "counties d" + d.properties.GEOID;
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
                redrawCircle(d.properties, "incarceratedCircle")
                drawHeatIndex(d.properties, ".linePlot1", 75, "heatIndexClick", colorScale)
                highlightClick(d.properties, colorScale, "heatIndexClick")
            })
            .on("mouseover", function (event, d) {
                redrawCircle(d.properties, "incarceratedHoverCircle");
                drawHeatIndex(d.properties, ".linePlot2", 595, "heatIndexHover", colorScale)
                highlight(d.properties, colorScale)
            })
            .on("mouseout", function (event, d) {
                if (d.properties.GEOID != clickedLayer) {
                    dehighlight()
                }
                d3.select(".infolabel").remove();
                d3.select(".chartlegendhover").remove();

            })
            .on("mousemove", moveLabel)
    }

    function setChart(csvData, colorScale, props) {
        //chart frame dimensions
        var chartWidth = window.innerWidth * 0.75,
            chartHeight = window.innerHeight * 0.22;

        //create a second svg element to hold the bar chart
        var chart = d3.select(".maphtml")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        var linePlot1 = d3.select(".chart")
            .append("svg")
            .attr("height", 200)
            .attr("width", 500)
            .attr("transform", "translate(70, 140)")
            .attr("class", "linePlot1");

        var linePlot2 = d3.select(".chart")
            .append("svg")
            .attr("height", 200)
            .attr("width", 500)
            .attr("transform", "translate(590, 140)")
            .attr("class", "linePlot2");

        //create axis

        var xAxis = d3.axisBottom(scaleY);

        //create axis g element and add axis
        var axis1 = linePlot1.append("g")
            .attr("class", "axis1")
            .attr("transform", "translate(75, 135)")
            .style("color","white")
            .call(xAxis)

        var axis2 = linePlot2.append("g")
            .attr("class", "axis2")
            .attr("transform", "translate(595, 135)")
            .style("color","white")
            .call(xAxis);

        var chartTitle = chart.append("text")
            .attr("x", 200)
            .attr("y", 20)
            .attr("class", "chartTitle")
            .text("Potential Heat Risk of Days Over " + selectedYear + " Degrees " + " for Incarcerated People")

        drawCircle();

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
                return 110;
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
                return 570;
            })
            .attr("cy", function (d) {
                return 110;
            });
    }

    function redrawCircle(data, type) {
        var circle = d3.select("." + type)
            .datum(data)
            .attr("id", function (d) {
                return "incarceratedCircle " + d.GEOID;
            })
            .transition()
            .duration(300)
            .attr("r", function (d) {
                var area = d["incarcerated_20"] * 0.4;
                return Math.sqrt(area / Math.PI);
            })

        d3.select(".chart").selectAll(".countylabel" + type).remove();
        var countylabel = d3.select(".chart").append("text")
            .datum(data)
            .attr("class", function (d) {
                return "countylabel" + type
            })
            .attr("text-anchor", "middle")
            .attr("x", function (d) {
                if (type == "incarceratedCircle") {
                    return 85
                }
                else {
                    return 580
                }
            })
            .attr("y", function (d) {
                return 50;
            })
            .transition()
            .duration(100)
            .text(function (d) {
                return d["NAMELSAD"];
            })
            .style("fill", "white");

        d3.select(".chart").selectAll(".numbers" + type).remove();
        var numbers = d3.select(".chart").append("text")
            .datum(data)
            .attr("class", function (d) {
                return "numbers" + type
            })
            .attr("text-anchor", "middle")
            .attr("x", function (d) {
                if (type == "incarceratedCircle") {
                    return 315
                }
                else {
                    return 810
                }
            })
            .attr("y", function (d) {
                return 50;
            })
            .transition()
            .duration(100)
            .text(function (d) {
                return "Incarcerated Population: " + d["incarcerated_20"];
            })
            .style("fill", "white");


    }

    function createDropdown(csvData, colorScale) {
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function () {
                changeAttribute(this.value, csvData, colorScale)
                updateChart(this.value)
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
                if (d == 127) {
                    return "Off the charts"
                } else
                    return d + " degrees"
            });
    }

    //dropdown change event handler
    function changeAttribute(attribute, csvData, colorScale) {
        //change the expressed attribute
        selectedYear = attribute
        expressed1 = "historical_" + attribute;

        //recolor enumeration units
        var counties = d3.selectAll(".counties")
            .transition()
            .duration(700)
            .style("fill", function (d) {
                var value = d.properties[expressed1];
                if (value) {
                    return colorScale(d.properties[expressed1]);
                } else {
                    return "#ccc";
                }
            });
    }

    function updateChart(attribute) {
        selectedYear = attribute;
        var chartTitle = d3.select(".chartTitle")
            .text(function () {
                if (selectedYear == 127) {
                    return "Potential Off the Charts Heat Risk for Incarcerated People"
                } else
                    return "Potential Heat Risk of Days Over " + selectedYear + " Degrees" + " for Incarcerated People"
            });
    }

    function drawHeatIndex(data, type, transform, label, colorScale) {

        d3.select(type).selectAll("circle").remove();
        var circle = d3.select(type)
            .selectAll("." + label)
            .data(["historical_" + selectedYear, "slow_" + selectedYear, "noaction_" + selectedYear, "rapid_" + selectedYear])
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
                return 110;
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

        d3.select(type).selectAll("." + label + "text").remove();
        var circleLabel = d3.select(type)
            .selectAll("." + label + "text")
            .data(["historical_" + selectedYear, "slow_" + selectedYear, "noaction_" + selectedYear, "rapid_" + selectedYear])
            .enter()
            .append("text")
            .attr("class", label + "text")
            .attr("id", function (d) {
                return d
            })
            .attr("x", function (d, i) {
                return scaleY(data[d]);
            })
            .attr("y", function (d) {
                return 95;
            })
            .attr("text-anchor", "middle")
            .attr("transform", "translate(" + transform + ")")
            .text(function (d) {
                return d[0]
            })
            ;
    }

    function setLabel(props, colorScale) {
        //label content
        var labelAttribute = "<h1>" + props[expressed1] +
            "</h1><b>days above " + selectedYear + " degrees</b>";

        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.GEOID + "_label")
            .html(labelAttribute)
            .style("background-color", function (d) {
                var value = props[expressed1];
                if (value) {
                    return colorScale(props[expressed1]);
                } else {
                    return "#ccc";
                }
            });

        var incarceration = infolabel.append("div")
            .attr("class", "labelincarceration")
            .html("Incarcerated Population: " + props["incarcerated_20"])

        var countyName = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.NAMELSAD);


    };

    function moveLabel() {

        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;

        //use coordinates of mousemove event to set label coordinates
        var x1 = event.clientX + 10,
            y1 = event.clientY - 75,
            x2 = event.clientX - labelWidth - 10,
            y2 = event.clientY + 25;

        //horizontal label coordinate, testing for overflow
        var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
        //vertical label coordinate, testing for overflow
        var y = event.clientY < 75 ? y2 : y1;
        //use coordinates of mousemove event to set label coordinates
        var x = event.clientX + 10,
            y = event.clientY - 75;

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };

    function createLabelLegend(props, colorScale){
        //label content
        var labelAttribute = "<h2>" + props.NAMELSAD + " days above " + selectedYear + " degrees" +
        "</h2><b>Incarcerated Population: </b>" + props["incarcerated_20"];

        //create info label div
        d3.select(".chartlegendhover").remove();
        var infolabel = d3.select(".labelhover")
            .append("div")
            .attr("class", "chartlegendhover")
            .attr("id", props.GEOID + "_label")
            .html(labelAttribute)
            .style("background-color", function (d) {
                var value = props[expressed1];
                if (value) {
                    return colorScale(props[expressed1]);
                } else {
                    return "#ccc";
                }
            })
            
        var heatrisk = infolabel.append("div")
            .attr("class", "labelheatrisk")
            .html(function (d) {
                return "<ul>" + "<b>h</b> = Historical heat risk: " + props["historical_" + selectedYear] + "</ul>" + 
                "<ul>" + "<b>n</b> = Heat risk with no climate action: " + props["noaction_" + selectedYear] + "</ul>" + 
                "<ul>" + "<b>s</b> = Heat risk with slow climate action: " + props["slow_" + selectedYear] + "</ul>" +
                "<ul>" + "<b>r</b> = Heat risk with rapid climate action: " + props["rapid_" + selectedYear] + "</ul>"
            })

    }

    function createLabelLegendClick(props, colorScale, label) {
        //label content
        var labelAttribute = "<h2>" + props.NAMELSAD + " days above " + selectedYear + " degrees" +
            "</h2><b>Incarcerated Population: </b>" + props["incarcerated_20"];

        //create info label div
        d3.select(".chartlegendclick").remove();
        var infolabel = d3.select(".labelclick")
            .append("div")
            .attr("class", "chartlegendclick")
            .attr("id", props.GEOID + "_label")
            .html(labelAttribute)
            .style("background-color", function (d) {
                var value = props[expressed1];
                if (value) {
                    return colorScale(props[expressed1]);
                } else {
                    return "#ccc";
                }
            })
            ;            

        var heatrisk = infolabel.append("div")
            .attr("class", "labelheatrisk")
            .html(function (d) {
                return "<ul>" + "<b>h</b> = Historical heat risk: " + props["historical_" + selectedYear] + "</ul>" + 
                "<ul>" + "<b>n</b> = Heat risk with no climate action: " + props["noaction_" + selectedYear] + "</ul>" + 
                "<ul>" + "<b>s</b> = Heat risk with slow climate action: " + props["slow_" + selectedYear] + "</ul>" +
                "<ul>" + "<b>r</b> = Heat risk with rapid climate action: " + props["rapid_" + selectedYear] + "</ul>"
            })

    }



})();
