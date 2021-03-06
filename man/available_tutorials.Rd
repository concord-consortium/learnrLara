% Generated by roxygen2: do not edit by hand
% Please edit documentation in R/available_tutorials.R
\name{available_tutorials}
\alias{available_tutorials}
\alias{format.learnr_available_tutorials}
\alias{print.learnr_available_tutorials}
\title{Run a tutorial}
\usage{
available_tutorials(package = NULL)

\method{format}{learnr_available_tutorials}(x, ...)

\method{print}{learnr_available_tutorials}(x, ...)
}
\arguments{
\item{package}{Name of package}

\item{name}{Tutorial name (subdirectory within \code{tutorials/}
directory of installed package).}

\item{shiny_args}{Additional arguments to forward to
\code{\link[shiny:runApp]{shiny::runApp}}.}
}
\value{
\code{available_tutorials} will return a \code{data.frame} containing "package", "name", and "title".
}
\description{
Run a tutorial which is contained within an R package.
}
\details{
Note that when running a tutorial Rmd file with \code{run_tutorial}
  the tutorial Rmd should have already been rendered as part of the
  development of the package (i.e. the corresponding tutorial .html file for
  the .Rmd file must exist).
}
